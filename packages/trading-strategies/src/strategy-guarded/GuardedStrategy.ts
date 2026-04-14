import Big from 'big.js';
import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeFill, LimitOrderAdvice, OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {Strategy} from '../strategy/Strategy.js';
import {positiveNumberString} from '../util/validators.js';

export const GuardedStrategySchema = z.object({
  /**
   * Stop-loss as a percentage of avg entry. "5" = sell everything at avgEntry * 0.95.
   * Mutually exclusive with `stopLossNominal` and `stopLossPrice`. Omit all three to
   * disable the stop-loss guard.
   */
  stopLossPct: positiveNumberString.optional(),
  /**
   * Stop-loss as an absolute unrealized loss in counter currency. "10" on a 10-share
   * position bought at $100 → fires at $99 (unrealized loss = $10). Mutually exclusive
   * with `stopLossPct` and `stopLossPrice`.
   */
  stopLossNominal: positiveNumberString.optional(),
  /**
   * Stop-loss as an absolute price target. "95" → fires as soon as the candle close
   * drops to $95 or below, placing a limit sell at $95. Mutually exclusive with
   * `stopLossPct` and `stopLossNominal`.
   */
  stopLossPrice: positiveNumberString.optional(),
  /**
   * Take-profit as a percentage of avg entry. "10" = sell everything at avgEntry * 1.10.
   * Mutually exclusive with `takeProfitNominal` and `takeProfitPrice`. Omit all three to
   * disable the take-profit guard.
   */
  takeProfitPct: positiveNumberString.optional(),
  /**
   * Take-profit as an absolute unrealized gain in counter currency. "10" on a 10-share
   * position bought at $100 → fires at $101 (unrealized gain = $10). Mutually exclusive
   * with `takeProfitPct` and `takeProfitPrice`.
   */
  takeProfitNominal: positiveNumberString.optional(),
  /**
   * Take-profit as an absolute price target. "105" → fires as soon as the candle close
   * reaches $105 or above, placing a limit sell at $105. Mutually exclusive with
   * `takeProfitPct` and `takeProfitNominal`.
   */
  takeProfitPrice: positiveNumberString.optional(),
  /**
   * Order type used to execute the stop-loss kill switch. `"limit"` (default) places a
   * limit sell at the nominal target price — guaranteed exit price, but may not fill if
   * the market gaps past the target. `"market"` places a market sell at the candle where
   * the guard trips — guaranteed fill, but exit price depends on the market.
   */
  stopLossOrder: z.enum(['limit', 'market']).default('limit'),
  /**
   * Order type used to execute the take-profit kill switch. See `stopLossOrder` for the
   * trade-off between `"limit"` (default) and `"market"`.
   */
  takeProfitOrder: z.enum(['limit', 'market']).default('limit'),
});

export type GuardedStrategyConfig = z.infer<typeof GuardedStrategySchema>;

type GuardOrderType = 'limit' | 'market';

type GuardMode =
  | {kind: 'pct'; pct: Big}
  | {kind: 'nominal'; nominal: Big}
  | {kind: 'price'; price: Big}
  | null;

export type GuardedStrategyState = {
  killed: boolean;
  killedReason: string | null;
  /** Order type used when a guard fires. `null` until a guard fires. */
  killedOrderType: GuardOrderType | null;
  /** Limit price of the kill-switch sell order, as a Big string. `null` for market orders or until a guard fires. */
  killedLimitPrice: string | null;
  /** Cumulative cost basis across all BUY fills: sum of (price * size). Stored as a Big string. */
  totalCostBasis: string;
  /** Net base quantity held (BUYs minus SELLs). Stored as a Big string. */
  totalPositionSize: string;
};

const GUARD_STATE_KEY = '__guard';

const defaultGuardState = (): GuardedStrategyState => ({
  killed: false,
  killedReason: null,
  killedOrderType: null,
  killedLimitPrice: null,
  totalCostBasis: '0',
  totalPositionSize: '0',
});

type GuardContainerState = {[GUARD_STATE_KEY]: GuardedStrategyState};

/**
 * A `Strategy` subclass that provides composable kill-switch behavior (stop-loss,
 * take-profit). Concrete strategies extend this class and call `super.processCandle()`
 * at the top of their own `processCandle`. If a guard fires, `super.processCandle()`
 * returns a limit-sell-all advice at the nominal target price and the subclass
 * should return immediately.
 *
 * The limit price is the nominal threshold price (`avgEntry * (1 ± threshold/100)`),
 * not the current market price — so the kill switch always exits at exactly the
 * configured percentage regardless of how far the market has already moved.
 *
 * Position tracking uses cost-basis averaging from `onFill` events, so it handles
 * multiple buys and partial sells correctly. Once a guard fires, the subclass is
 * never called again for this session; the strategy keeps emitting the limit-sell
 * advice on every candle until `onFill` confirms the position is fully exited —
 * so a rejected or delayed placement is automatically retried.
 *
 * Usage:
 *
 *     const schema = GuardedStrategySchema.extend({ mySetting: z.string() });
 *     class MyStrategy extends GuardedStrategy {
 *       constructor(config: z.infer<typeof schema>) {
 *         super({ config, state: { mySubclassField: 0 } });
 *       }
 *       protected override async processCandle(candle, state) {
 *         const guardAdvice = await super.processCandle(candle, state);
 *         if (guardAdvice) return guardAdvice;
 *         // ... own logic
 *       }
 *     }
 */
export abstract class GuardedStrategy extends Strategy {
  readonly #stopLoss: GuardMode;
  readonly #takeProfit: GuardMode;
  readonly #stopLossOrder: GuardOrderType;
  readonly #takeProfitOrder: GuardOrderType;

  constructor(options: {config: Record<string, unknown>; state?: Record<string, unknown>}) {
    super({
      config: options.config,
      state: {
        ...options.state,
        [GUARD_STATE_KEY]: defaultGuardState(),
      },
    });

    const guardConfig = GuardedStrategySchema.parse({
      stopLossPct: options.config.stopLossPct,
      stopLossNominal: options.config.stopLossNominal,
      stopLossPrice: options.config.stopLossPrice,
      takeProfitPct: options.config.takeProfitPct,
      takeProfitNominal: options.config.takeProfitNominal,
      takeProfitPrice: options.config.takeProfitPrice,
      stopLossOrder: options.config.stopLossOrder,
      takeProfitOrder: options.config.takeProfitOrder,
    });

    // Zod's `.refine()` would turn the schema into `ZodEffects`, which cannot
    // be `.extend()`-ed by subclasses. Mutual exclusion is validated here instead.
    const stopLossFields = [guardConfig.stopLossPct, guardConfig.stopLossNominal, guardConfig.stopLossPrice].filter(
      (value): value is string => value !== undefined
    );
    if (stopLossFields.length > 1) {
      throw new Error(
        'GuardedStrategy: stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive — set at most one'
      );
    }

    const takeProfitFields = [
      guardConfig.takeProfitPct,
      guardConfig.takeProfitNominal,
      guardConfig.takeProfitPrice,
    ].filter((value): value is string => value !== undefined);
    if (takeProfitFields.length > 1) {
      throw new Error(
        'GuardedStrategy: takeProfitPct, takeProfitNominal, and takeProfitPrice are mutually exclusive — set at most one'
      );
    }

    this.#stopLoss = guardConfig.stopLossPct
      ? {kind: 'pct', pct: new Big(guardConfig.stopLossPct)}
      : guardConfig.stopLossNominal
        ? {kind: 'nominal', nominal: new Big(guardConfig.stopLossNominal)}
        : guardConfig.stopLossPrice
          ? {kind: 'price', price: new Big(guardConfig.stopLossPrice)}
          : null;

    this.#takeProfit = guardConfig.takeProfitPct
      ? {kind: 'pct', pct: new Big(guardConfig.takeProfitPct)}
      : guardConfig.takeProfitNominal
        ? {kind: 'nominal', nominal: new Big(guardConfig.takeProfitNominal)}
        : guardConfig.takeProfitPrice
          ? {kind: 'price', price: new Big(guardConfig.takeProfitPrice)}
          : null;

    this.#stopLossOrder = guardConfig.stopLossOrder;
    this.#takeProfitOrder = guardConfig.takeProfitOrder;
  }

  get #guardState(): GuardedStrategyState {
    return this.getProxiedState<GuardContainerState>()[GUARD_STATE_KEY];
  }

  /**
   * Reassigns the top-level `__guard` key on the proxied state with a merged
   * snapshot. The top-level write triggers the base `Strategy` Proxy's `set`
   * trap, which in turn fires `onSave` so `StrategyMonitor` persists to the DB.
   * Nested property mutations would silently bypass persistence.
   */
  #setGuardState(patch: Partial<GuardedStrategyState>): void {
    const proxied = this.getProxiedState<GuardContainerState>();
    proxied[GUARD_STATE_KEY] = {...proxied[GUARD_STATE_KEY], ...patch};
  }

  /** Read-only snapshot of the current guard state. Useful for tests and diagnostics. */
  get guardState(): Readonly<GuardedStrategyState> {
    return {...this.#guardState};
  }

  /**
   * Once a guard has fired, the subclass is never called again. If the position
   * is still non-zero (the sell order was rejected or hasn't filled yet), this
   * keeps re-emitting the kill-switch advice (limit at the stored target price
   * or a market sell, depending on the configured order type) until `onFill`
   * brings the position to zero. Only then does `onCandle` return `void`.
   */
  override async onCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    this.lastBatchedCandle = candle;

    const guardState = this.#guardState;
    if (guardState.killed) {
      const positionSize = new Big(guardState.totalPositionSize);
      if (positionSize.gt(0) && guardState.killedOrderType) {
        const limitPrice = guardState.killedLimitPrice ? new Big(guardState.killedLimitPrice) : null;
        const advice = this.#killSwitchAdvice(
          guardState.killedReason ?? 'kill switch',
          guardState.killedOrderType,
          limitPrice
        );
        this.latestAdvice = advice;
        return advice;
      }
      this.latestAdvice = undefined;
      return;
    }

    const advice = await this.processCandle(candle, state);
    this.latestAdvice = advice ? advice : undefined;
    return advice;
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    _state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    if (!this.#stopLoss && !this.#takeProfit) {
      return;
    }

    const guardState = this.#guardState;
    const positionSize = new Big(guardState.totalPositionSize);
    if (positionSize.lte(0)) {
      return;
    }

    const avgEntry = new Big(guardState.totalCostBasis).div(positionSize);
    const currentPrice = candle.close;

    if (this.#stopLoss) {
      const targetPrice = this.#resolveStopLossLimit(avgEntry, positionSize);
      if (currentPrice.lte(targetPrice)) {
        const orderType = this.#stopLossOrder;
        const reason = this.#stopLossReason(avgEntry, currentPrice, positionSize, targetPrice, orderType);
        this.#setGuardState({
          killed: true,
          killedReason: reason,
          killedOrderType: orderType,
          killedLimitPrice: orderType === 'limit' ? targetPrice.toFixed() : null,
        });
        return this.#killSwitchAdvice(reason, orderType, orderType === 'limit' ? targetPrice : null);
      }
    }

    if (this.#takeProfit) {
      const targetPrice = this.#resolveTakeProfitLimit(avgEntry, positionSize);
      if (currentPrice.gte(targetPrice)) {
        const orderType = this.#takeProfitOrder;
        const reason = this.#takeProfitReason(avgEntry, currentPrice, positionSize, targetPrice, orderType);
        this.#setGuardState({
          killed: true,
          killedReason: reason,
          killedOrderType: orderType,
          killedLimitPrice: orderType === 'limit' ? targetPrice.toFixed() : null,
        });
        return this.#killSwitchAdvice(reason, orderType, orderType === 'limit' ? targetPrice : null);
      }
    }
  }

  #resolveStopLossLimit(avgEntry: Big, positionSize: Big): Big {
    if (!this.#stopLoss) {
      throw new Error('unreachable: stop-loss is not configured');
    }
    switch (this.#stopLoss.kind) {
      case 'pct':
        return avgEntry.mul(new Big(1).minus(this.#stopLoss.pct.div(100)));
      case 'nominal':
        return avgEntry.minus(this.#stopLoss.nominal.div(positionSize));
      case 'price':
        return this.#stopLoss.price;
    }
  }

  #resolveTakeProfitLimit(avgEntry: Big, positionSize: Big): Big {
    if (!this.#takeProfit) {
      throw new Error('unreachable: take-profit is not configured');
    }
    switch (this.#takeProfit.kind) {
      case 'pct':
        return avgEntry.mul(new Big(1).plus(this.#takeProfit.pct.div(100)));
      case 'nominal':
        return avgEntry.plus(this.#takeProfit.nominal.div(positionSize));
      case 'price':
        return this.#takeProfit.price;
    }
  }

  #stopLossReason(
    avgEntry: Big,
    currentPrice: Big,
    positionSize: Big,
    targetPrice: Big,
    orderType: GuardOrderType
  ): string {
    if (!this.#stopLoss) {
      return '';
    }
    const orderSuffix = orderType === 'limit' ? `(limit ${targetPrice.toFixed()})` : '(market)';
    switch (this.#stopLoss.kind) {
      case 'pct': {
        const pctChange = currentPrice.minus(avgEntry).div(avgEntry).mul(100);
        return `Stop-loss: ${pctChange.toFixed(2)}% <= -${this.#stopLoss.pct.toFixed(2)}% ${orderSuffix}`;
      }
      case 'nominal': {
        const unrealized = currentPrice.minus(avgEntry).mul(positionSize);
        return `Stop-loss: unrealized ${unrealized.toFixed(2)} <= -${this.#stopLoss.nominal.toFixed(2)} ${orderSuffix}`;
      }
      case 'price':
        return `Stop-loss: price ${currentPrice.toFixed()} <= target ${this.#stopLoss.price.toFixed()} ${orderSuffix}`;
    }
  }

  #takeProfitReason(
    avgEntry: Big,
    currentPrice: Big,
    positionSize: Big,
    targetPrice: Big,
    orderType: GuardOrderType
  ): string {
    if (!this.#takeProfit) {
      return '';
    }
    const orderSuffix = orderType === 'limit' ? `(limit ${targetPrice.toFixed()})` : '(market)';
    switch (this.#takeProfit.kind) {
      case 'pct': {
        const pctChange = currentPrice.minus(avgEntry).div(avgEntry).mul(100);
        return `Take-profit: +${pctChange.toFixed(2)}% >= +${this.#takeProfit.pct.toFixed(2)}% ${orderSuffix}`;
      }
      case 'nominal': {
        const unrealized = currentPrice.minus(avgEntry).mul(positionSize);
        return `Take-profit: unrealized +${unrealized.toFixed(2)} >= +${this.#takeProfit.nominal.toFixed(2)} ${orderSuffix}`;
      }
      case 'price':
        return `Take-profit: price ${currentPrice.toFixed()} >= target ${this.#takeProfit.price.toFixed()} ${orderSuffix}`;
    }
  }

  async onFill(fill: ExchangeFill, _state: TradingSessionState): Promise<void> {
    const guardState = this.#guardState;
    const fillPrice = new Big(fill.price);
    const fillSize = new Big(fill.size);

    if (fill.side === ExchangeOrderSide.BUY) {
      const newCostBasis = new Big(guardState.totalCostBasis).plus(fillPrice.mul(fillSize));
      const newPositionSize = new Big(guardState.totalPositionSize).plus(fillSize);
      this.#setGuardState({
        totalCostBasis: newCostBasis.toFixed(),
        totalPositionSize: newPositionSize.toFixed(),
      });
      return;
    }

    // SELL: reduce position proportionally using the current average entry price.
    const currentPositionSize = new Big(guardState.totalPositionSize);
    if (currentPositionSize.lte(0)) {
      return;
    }

    const avgEntry = new Big(guardState.totalCostBasis).div(currentPositionSize);
    const newPositionSize = currentPositionSize.minus(fillSize);

    if (newPositionSize.lte(0)) {
      this.#setGuardState({totalCostBasis: '0', totalPositionSize: '0'});
      return;
    }

    this.#setGuardState({
      totalCostBasis: avgEntry.mul(newPositionSize).toFixed(),
      totalPositionSize: newPositionSize.toFixed(),
    });
  }

  override restoreState(persisted: Record<string, unknown>): void {
    const existing = persisted[GUARD_STATE_KEY];
    const restoredGuard: GuardedStrategyState = isGuardedState(existing) ? existing : defaultGuardState();

    super.restoreState({
      ...persisted,
      [GUARD_STATE_KEY]: restoredGuard,
    });

    // The base class only updates `#_state`; the proxied state still points at
    // the original object from the constructor. Reassigning `__guard` through
    // the proxy propagates restored values into the proxied state.
    this.#setGuardState(restoredGuard);
  }

  #killSwitchAdvice(reason: string, orderType: GuardOrderType, limitPrice: Big | null): OrderAdvice {
    if (orderType === 'market') {
      return {
        side: ExchangeOrderSide.SELL,
        type: ExchangeOrderType.MARKET,
        amount: null,
        amountIn: 'base',
        reason: `[KILL SWITCH] ${reason}`,
      };
    }
    if (!limitPrice) {
      throw new Error('GuardedStrategy: limit order type requires a limit price');
    }
    const advice: LimitOrderAdvice = {
      side: ExchangeOrderSide.SELL,
      type: ExchangeOrderType.LIMIT,
      amount: null,
      amountIn: 'base',
      price: limitPrice,
      reason: `[KILL SWITCH] ${reason}`,
    };
    return advice;
  }
}

function isGuardedState(value: unknown): value is GuardedStrategyState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const validOrderType =
    candidate.killedOrderType === null ||
    candidate.killedOrderType === 'limit' ||
    candidate.killedOrderType === 'market';
  return (
    typeof candidate.killed === 'boolean' &&
    (candidate.killedReason === null || typeof candidate.killedReason === 'string') &&
    validOrderType &&
    (candidate.killedLimitPrice === null || typeof candidate.killedLimitPrice === 'string') &&
    typeof candidate.totalCostBasis === 'string' &&
    typeof candidate.totalPositionSize === 'string'
  );
}
