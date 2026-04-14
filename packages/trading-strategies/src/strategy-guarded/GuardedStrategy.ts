import Big from 'big.js';
import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeFill, LimitOrderAdvice, OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {Strategy} from '../strategy/Strategy.js';
import {positiveNumberString} from '../util/validators.js';

/**
 * All kill-switch settings live under a single nested `guarded` key so they can't
 * collide with the subclass's own config fields.
 */
export const GuardedConfigSchema = z.object({
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

/** All of the kill-switch settings, nested under a single namespaced `guarded` key. */
export const GuardedStrategySchema = z.object({
  guarded: GuardedConfigSchema.optional(),
});

export type GuardedConfig = z.infer<typeof GuardedConfigSchema>;
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

const GUARDED_STATE_KEY = 'guarded';

const defaultGuardedState = (): GuardedStrategyState => ({
  killed: false,
  killedReason: null,
  killedOrderType: null,
  killedLimitPrice: null,
  totalCostBasis: '0',
  totalPositionSize: '0',
});

type GuardedContainerState = {[GUARDED_STATE_KEY]: GuardedStrategyState};

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
        [GUARDED_STATE_KEY]: defaultGuardedState(),
      },
    });

    // Parse only the nested `guarded` sub-object — the subclass owns the rest of the config.
    const guardedConfig = GuardedConfigSchema.parse(options.config[GUARDED_STATE_KEY] ?? {});

    // Zod's `.refine()` would turn the schema into `ZodEffects`, which cannot
    // be `.extend()`-ed by subclasses. Mutual exclusion is validated here instead.
    const stopLossFields = [
      guardedConfig.stopLossPct,
      guardedConfig.stopLossNominal,
      guardedConfig.stopLossPrice,
    ].filter((value): value is string => value !== undefined);
    if (stopLossFields.length > 1) {
      throw new Error(
        'GuardedStrategy: stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive — set at most one'
      );
    }

    const takeProfitFields = [
      guardedConfig.takeProfitPct,
      guardedConfig.takeProfitNominal,
      guardedConfig.takeProfitPrice,
    ].filter((value): value is string => value !== undefined);
    if (takeProfitFields.length > 1) {
      throw new Error(
        'GuardedStrategy: takeProfitPct, takeProfitNominal, and takeProfitPrice are mutually exclusive — set at most one'
      );
    }

    this.#stopLoss = guardedConfig.stopLossPct
      ? {kind: 'pct', pct: new Big(guardedConfig.stopLossPct)}
      : guardedConfig.stopLossNominal
        ? {kind: 'nominal', nominal: new Big(guardedConfig.stopLossNominal)}
        : guardedConfig.stopLossPrice
          ? {kind: 'price', price: new Big(guardedConfig.stopLossPrice)}
          : null;

    this.#takeProfit = guardedConfig.takeProfitPct
      ? {kind: 'pct', pct: new Big(guardedConfig.takeProfitPct)}
      : guardedConfig.takeProfitNominal
        ? {kind: 'nominal', nominal: new Big(guardedConfig.takeProfitNominal)}
        : guardedConfig.takeProfitPrice
          ? {kind: 'price', price: new Big(guardedConfig.takeProfitPrice)}
          : null;

    this.#stopLossOrder = guardedConfig.stopLossOrder;
    this.#takeProfitOrder = guardedConfig.takeProfitOrder;
  }

  get #guardedState(): GuardedStrategyState {
    return this.getProxiedState<GuardedContainerState>()[GUARDED_STATE_KEY];
  }

  /**
   * Reassigns the top-level `guarded` key on the proxied state with a merged
   * snapshot. The top-level write triggers the base `Strategy` Proxy's `set`
   * trap, which in turn fires `onSave` so `StrategyMonitor` persists to the DB.
   * Nested property mutations would silently bypass persistence.
   */
  #setGuardedState(patch: Partial<GuardedStrategyState>): void {
    const proxied = this.getProxiedState<GuardedContainerState>();
    proxied[GUARDED_STATE_KEY] = {...proxied[GUARDED_STATE_KEY], ...patch};
  }

  /** Read-only snapshot of the current guarded state. Useful for tests and diagnostics. */
  get guardedState(): Readonly<GuardedStrategyState> {
    return {...this.#guardedState};
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

    const guardedState = this.#guardedState;
    if (guardedState.killed) {
      const positionSize = new Big(guardedState.totalPositionSize);
      if (positionSize.gt(0) && guardedState.killedOrderType) {
        const limitPrice = guardedState.killedLimitPrice ? new Big(guardedState.killedLimitPrice) : null;
        const advice = this.#killSwitchAdvice(
          guardedState.killedReason ?? 'kill switch',
          guardedState.killedOrderType,
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

    const guardedState = this.#guardedState;
    const positionSize = new Big(guardedState.totalPositionSize);
    if (positionSize.lte(0)) {
      return;
    }

    const avgEntry = new Big(guardedState.totalCostBasis).div(positionSize);
    const currentPrice = candle.close;

    if (this.#stopLoss) {
      const targetPrice = this.#resolveStopLossLimit(avgEntry, positionSize);
      if (currentPrice.lte(targetPrice)) {
        const orderType = this.#stopLossOrder;
        const reason = this.#stopLossReason(avgEntry, currentPrice, positionSize, targetPrice, orderType);
        this.#setGuardedState({
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
        this.#setGuardedState({
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
    const guardedState = this.#guardedState;
    const fillPrice = new Big(fill.price);
    const fillSize = new Big(fill.size);

    if (fill.side === ExchangeOrderSide.BUY) {
      const newCostBasis = new Big(guardedState.totalCostBasis).plus(fillPrice.mul(fillSize));
      const newPositionSize = new Big(guardedState.totalPositionSize).plus(fillSize);
      this.#setGuardedState({
        totalCostBasis: newCostBasis.toFixed(),
        totalPositionSize: newPositionSize.toFixed(),
      });
      return;
    }

    // SELL: reduce position proportionally using the current average entry price.
    const currentPositionSize = new Big(guardedState.totalPositionSize);
    if (currentPositionSize.lte(0)) {
      return;
    }

    const avgEntry = new Big(guardedState.totalCostBasis).div(currentPositionSize);
    const newPositionSize = currentPositionSize.minus(fillSize);

    if (newPositionSize.lte(0)) {
      this.#setGuardedState({totalCostBasis: '0', totalPositionSize: '0'});
      return;
    }

    this.#setGuardedState({
      totalCostBasis: avgEntry.mul(newPositionSize).toFixed(),
      totalPositionSize: newPositionSize.toFixed(),
    });
  }

  override restoreState(persisted: Record<string, unknown>): void {
    const existing = persisted[GUARDED_STATE_KEY];
    const restoredGuarded: GuardedStrategyState = isGuardedStrategyState(existing) ? existing : defaultGuardedState();

    super.restoreState({
      ...persisted,
      [GUARDED_STATE_KEY]: restoredGuarded,
    });

    // The base class only updates `#_state`; the proxied state still points at
    // the original object from the constructor. Reassigning `guarded` through
    // the proxy propagates restored values into the proxied state.
    this.#setGuardedState(restoredGuarded);
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

function isGuardedStrategyState(value: unknown): value is GuardedStrategyState {
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
