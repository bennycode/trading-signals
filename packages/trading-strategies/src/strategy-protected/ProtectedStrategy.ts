import Big from 'big.js';
import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeFill, LimitOrderAdvice, OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {Strategy} from '../strategy/Strategy.js';
import {positiveNumberString} from '../util/validators.js';

/**
 * All kill-switch settings live under a single nested `protected` key so they can't
 * collide with the subclass's own config fields.
 */
export const ProtectedConfigSchema = z.object({
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

/** All of the kill-switch settings, nested under a single namespaced `protected` key. */
export const ProtectedStrategySchema = z.object({
  protected: ProtectedConfigSchema.optional(),
});

export type ProtectedConfig = z.infer<typeof ProtectedConfigSchema>;
export type ProtectedStrategyConfig = z.infer<typeof ProtectedStrategySchema>;

type GuardOrderType = 'limit' | 'market';

type GuardMode =
  | {kind: 'pct'; pct: Big}
  | {kind: 'nominal'; nominal: Big}
  | {kind: 'price'; price: Big}
  | null;

export type ProtectedStrategyState = {
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

const PROTECTED_STATE_KEY = 'protected';

const defaultProtectedState = (): ProtectedStrategyState => ({
  killed: false,
  killedReason: null,
  killedOrderType: null,
  killedLimitPrice: null,
  totalCostBasis: '0',
  totalPositionSize: '0',
});

type ProtectedContainerState = {[PROTECTED_STATE_KEY]: ProtectedStrategyState};

/**
 * A `Strategy` subclass that provides composable kill-switch behavior (stop-loss,
 * take-profit). Concrete strategies extend this class and call `super.processCandle()`
 * at the top of their own `processCandle`. If a guard fires, `super.processCandle()`
 * returns a sell-all advice using the configured kill-switch order type, and the
 * subclass should return immediately.
 *
 * Kill-switch orders can be configured as either `limit` (default) or `market` per
 * direction via `stopLossOrder` / `takeProfitOrder`. For `limit` orders, the advice
 * uses the nominal threshold price (for example, `avgEntry * (1 ± threshold/100)`
 * for percentage-based guards) rather than the current market price — the kill
 * switch exits at exactly the configured percentage regardless of how far the
 * market has already moved, at the cost of possibly not filling in a gap scenario.
 * For `market` orders, there is no nominal limit price and the exit price is
 * whatever the prevailing market offers at the firing candle — guaranteed fill,
 * unpredictable price.
 *
 * Position tracking uses cost-basis averaging from `onFill` events, so it handles
 * multiple buys and partial sells correctly. Once a guard fires, the subclass is
 * never called again for this session; the strategy keeps emitting the same
 * sell-all advice (limit with the stored target price, or market) on every candle
 * until `onFill` confirms the position is fully exited — so a rejected or delayed
 * placement is automatically retried.
 *
 * Usage:
 *
 *     const schema = ProtectedStrategySchema.extend({ mySetting: z.string() });
 *     class MyStrategy extends ProtectedStrategy {
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
export abstract class ProtectedStrategy extends Strategy {
  readonly #stopLoss: GuardMode;
  readonly #takeProfit: GuardMode;
  readonly #stopLossOrder: GuardOrderType;
  readonly #takeProfitOrder: GuardOrderType;

  constructor(options: {config: Record<string, unknown>; state?: Record<string, unknown>}) {
    super({
      config: options.config,
      state: {
        ...options.state,
        [PROTECTED_STATE_KEY]: defaultProtectedState(),
      },
    });

    // Parse only the nested `protected` sub-object — the subclass owns the rest of the config.
    const protectedConfig = ProtectedConfigSchema.parse(options.config[PROTECTED_STATE_KEY] ?? {});

    // Zod's `.refine()` would turn the schema into `ZodEffects`, which cannot
    // be `.extend()`-ed by subclasses. Mutual exclusion is validated here instead.
    const stopLossFields = [
      protectedConfig.stopLossPct,
      protectedConfig.stopLossNominal,
      protectedConfig.stopLossPrice,
    ].filter((value): value is string => value !== undefined);
    if (stopLossFields.length > 1) {
      throw new Error(
        'ProtectedStrategy: stopLossPct, stopLossNominal, and stopLossPrice are mutually exclusive — set at most one'
      );
    }

    const takeProfitFields = [
      protectedConfig.takeProfitPct,
      protectedConfig.takeProfitNominal,
      protectedConfig.takeProfitPrice,
    ].filter((value): value is string => value !== undefined);
    if (takeProfitFields.length > 1) {
      throw new Error(
        'ProtectedStrategy: takeProfitPct, takeProfitNominal, and takeProfitPrice are mutually exclusive — set at most one'
      );
    }

    this.#stopLoss = protectedConfig.stopLossPct
      ? {kind: 'pct', pct: new Big(protectedConfig.stopLossPct)}
      : protectedConfig.stopLossNominal
        ? {kind: 'nominal', nominal: new Big(protectedConfig.stopLossNominal)}
        : protectedConfig.stopLossPrice
          ? {kind: 'price', price: new Big(protectedConfig.stopLossPrice)}
          : null;

    this.#takeProfit = protectedConfig.takeProfitPct
      ? {kind: 'pct', pct: new Big(protectedConfig.takeProfitPct)}
      : protectedConfig.takeProfitNominal
        ? {kind: 'nominal', nominal: new Big(protectedConfig.takeProfitNominal)}
        : protectedConfig.takeProfitPrice
          ? {kind: 'price', price: new Big(protectedConfig.takeProfitPrice)}
          : null;

    this.#stopLossOrder = protectedConfig.stopLossOrder;
    this.#takeProfitOrder = protectedConfig.takeProfitOrder;
  }

  get #protectedState(): ProtectedStrategyState {
    return this.getProxiedState<ProtectedContainerState>()[PROTECTED_STATE_KEY];
  }

  /**
   * Reassigns the top-level `protected` key on the proxied state with a merged
   * snapshot. The top-level write triggers the base `Strategy` Proxy's `set`
   * trap, which in turn fires `onSave` so `StrategyMonitor` persists to the DB.
   * Nested property mutations would silently bypass persistence.
   */
  #setProtectedState(patch: Partial<ProtectedStrategyState>): void {
    const proxied = this.getProxiedState<ProtectedContainerState>();
    proxied[PROTECTED_STATE_KEY] = {...proxied[PROTECTED_STATE_KEY], ...patch};
  }

  /** Read-only snapshot of the current protected state. Useful for tests and diagnostics. */
  get protectedState(): Readonly<ProtectedStrategyState> {
    return {...this.#protectedState};
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

    const protectedState = this.#protectedState;
    if (protectedState.killed) {
      const positionSize = new Big(protectedState.totalPositionSize);
      if (positionSize.gt(0) && protectedState.killedOrderType) {
        const limitPrice = protectedState.killedLimitPrice ? new Big(protectedState.killedLimitPrice) : null;
        const advice = this.#killSwitchAdvice(
          protectedState.killedReason ?? 'kill switch',
          protectedState.killedOrderType,
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

    const protectedState = this.#protectedState;
    const positionSize = new Big(protectedState.totalPositionSize);
    if (positionSize.lte(0)) {
      return;
    }

    const avgEntry = new Big(protectedState.totalCostBasis).div(positionSize);
    const currentPrice = candle.close;

    if (this.#stopLoss) {
      const targetPrice = this.#resolveStopLossLimit(avgEntry, positionSize);
      if (currentPrice.lte(targetPrice)) {
        const orderType = this.#stopLossOrder;
        const reason = this.#stopLossReason(avgEntry, currentPrice, positionSize, targetPrice, orderType);
        this.#setProtectedState({
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
        this.#setProtectedState({
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
    const protectedState = this.#protectedState;
    const fillPrice = new Big(fill.price);
    const fillSize = new Big(fill.size);

    if (fill.side === ExchangeOrderSide.BUY) {
      const newCostBasis = new Big(protectedState.totalCostBasis).plus(fillPrice.mul(fillSize));
      const newPositionSize = new Big(protectedState.totalPositionSize).plus(fillSize);
      this.#setProtectedState({
        totalCostBasis: newCostBasis.toFixed(),
        totalPositionSize: newPositionSize.toFixed(),
      });
      return;
    }

    // SELL: reduce position proportionally using the current average entry price.
    const currentPositionSize = new Big(protectedState.totalPositionSize);
    if (currentPositionSize.lte(0)) {
      return;
    }

    const avgEntry = new Big(protectedState.totalCostBasis).div(currentPositionSize);
    const newPositionSize = currentPositionSize.minus(fillSize);

    if (newPositionSize.lte(0)) {
      this.#setProtectedState({totalCostBasis: '0', totalPositionSize: '0'});
      return;
    }

    this.#setProtectedState({
      totalCostBasis: avgEntry.mul(newPositionSize).toFixed(),
      totalPositionSize: newPositionSize.toFixed(),
    });
  }

  override restoreState(persisted: Record<string, unknown>): void {
    const existing = persisted[PROTECTED_STATE_KEY];
    const restoredProtected: ProtectedStrategyState = isProtectedStrategyState(existing)
      ? existing
      : defaultProtectedState();

    super.restoreState({
      ...persisted,
      [PROTECTED_STATE_KEY]: restoredProtected,
    });

    // The base class only updates `#_state`; the proxied state still points at
    // the original object from the constructor. Reassigning `protected` through
    // the proxy propagates restored values into the proxied state.
    this.#setProtectedState(restoredProtected);
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
      throw new Error('ProtectedStrategy: limit order type requires a limit price');
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

/**
 * Validates that a persisted object is a well-formed `ProtectedStrategyState`.
 *
 * Beyond shape checks, this also enforces cross-field invariants that
 * `restoreState` relies on to produce a safe runtime state:
 *
 * - If `killed === true`, `killedOrderType` must be set so the retry path in
 *   `onCandle` can re-emit the correct advice kind. A `killed=true` state with
 *   `killedOrderType=null` would leave an open position with no further exit.
 * - If `killedOrderType === 'limit'`, `killedLimitPrice` must be set so the
 *   retry can re-build the limit advice.
 * - Numeric string fields (`totalCostBasis`, `totalPositionSize`,
 *   `killedLimitPrice`) must be parseable by `Big` — otherwise the next
 *   `onCandle` would throw inside `new Big(...)`.
 *
 * Returning `false` from here causes `restoreState` to fall back to the
 * default state, re-arming the guards on the next candle.
 */
function isProtectedStrategyState(value: unknown): value is ProtectedStrategyState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;

  if (typeof candidate.killed !== 'boolean') return false;
  if (candidate.killedReason !== null && typeof candidate.killedReason !== 'string') return false;
  if (
    candidate.killedOrderType !== null &&
    candidate.killedOrderType !== 'limit' &&
    candidate.killedOrderType !== 'market'
  ) {
    return false;
  }
  if (candidate.killedLimitPrice !== null && typeof candidate.killedLimitPrice !== 'string') return false;
  if (typeof candidate.totalCostBasis !== 'string' || !isValidBigString(candidate.totalCostBasis)) return false;
  if (typeof candidate.totalPositionSize !== 'string' || !isValidBigString(candidate.totalPositionSize)) return false;
  if (typeof candidate.killedLimitPrice === 'string' && !isValidBigString(candidate.killedLimitPrice)) return false;

  // Cross-field invariants: a killed state must be fully specified so that
  // the retry path in onCandle has everything it needs to build fresh advice.
  if (candidate.killed === true) {
    if (candidate.killedOrderType === null) return false;
    if (candidate.killedOrderType === 'limit' && candidate.killedLimitPrice === null) return false;
  }

  return true;
}

function isValidBigString(value: string): boolean {
  try {
    new Big(value);
    return true;
  } catch {
    return false;
  }
}
