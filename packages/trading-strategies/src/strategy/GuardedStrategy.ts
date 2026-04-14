import Big from 'big.js';
import {z} from 'zod';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeFill, OneMinuteBatchedCandle, OrderAdvice, TradingSessionState} from '@typedtrader/exchange';
import {Strategy} from './Strategy.js';
import {positiveNumberString} from '../util/validators.js';

export const GuardedStrategySchema = z.object({
  /** Stop-loss threshold as percentage, e.g. "5" = market-sell everything at -5% unrealized loss. Omit to disable. */
  stopLossPct: positiveNumberString.optional(),
  /** Take-profit threshold as percentage, e.g. "10" = market-sell everything at +10% unrealized gain. Omit to disable. */
  takeProfitPct: positiveNumberString.optional(),
});

export type GuardedStrategyConfig = z.infer<typeof GuardedStrategySchema>;

export type GuardedStrategyState = {
  killed: boolean;
  killedReason: string | null;
  /** Cumulative cost basis across all BUY fills: sum of (price * size). Stored as a Big string. */
  totalCostBasis: string;
  /** Net base quantity held (BUYs minus SELLs). Stored as a Big string. */
  totalPositionSize: string;
};

const GUARD_STATE_KEY = '__guard';

const defaultGuardState = (): GuardedStrategyState => ({
  killed: false,
  killedReason: null,
  totalCostBasis: '0',
  totalPositionSize: '0',
});

type GuardContainerState = {[GUARD_STATE_KEY]: GuardedStrategyState};

/**
 * A `Strategy` subclass that provides composable kill-switch behavior (stop-loss,
 * take-profit). Concrete strategies extend this class and call `super.processCandle()`
 * at the top of their own `processCandle`. If a guard fires, `super.processCandle()`
 * returns a market-sell-all advice and the subclass should return immediately.
 *
 * Position tracking uses cost-basis averaging from `onFill` events, so it handles
 * multiple buys and partial sells correctly. Once a guard fires, the subclass is
 * never called again for this session; the strategy keeps emitting the sell-all
 * advice on every candle until `onFill` confirms the position is fully exited —
 * so a rejected or delayed market order is automatically retried.
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
  readonly #stopLossPct: Big | null;
  readonly #takeProfitPct: Big | null;

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
      takeProfitPct: options.config.takeProfitPct,
    });

    this.#stopLossPct = guardConfig.stopLossPct ? new Big(guardConfig.stopLossPct) : null;
    this.#takeProfitPct = guardConfig.takeProfitPct ? new Big(guardConfig.takeProfitPct) : null;
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
   * keeps re-emitting the sell-all advice until `onFill` brings the position to
   * zero. Only then does `onCandle` return `void`.
   */
  override async onCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    this.lastBatchedCandle = candle;

    const guardState = this.#guardState;
    if (guardState.killed) {
      const positionSize = new Big(guardState.totalPositionSize);
      if (positionSize.gt(0)) {
        const advice = this.#marketSellAll(guardState.killedReason ?? 'kill switch');
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
    if (!this.#stopLossPct && !this.#takeProfitPct) {
      return;
    }

    const guardState = this.#guardState;
    const positionSize = new Big(guardState.totalPositionSize);
    if (positionSize.lte(0)) {
      return;
    }

    const avgEntry = new Big(guardState.totalCostBasis).div(positionSize);
    const currentPrice = candle.close;
    const pctChange = currentPrice.minus(avgEntry).div(avgEntry).mul(100);

    if (this.#stopLossPct && pctChange.lte(this.#stopLossPct.neg())) {
      const reason = `Stop-loss: ${pctChange.toFixed(2)}% <= -${this.#stopLossPct.toFixed(2)}%`;
      this.#setGuardState({killed: true, killedReason: reason});
      return this.#marketSellAll(reason);
    }

    if (this.#takeProfitPct && pctChange.gte(this.#takeProfitPct)) {
      const reason = `Take-profit: +${pctChange.toFixed(2)}% >= +${this.#takeProfitPct.toFixed(2)}%`;
      this.#setGuardState({killed: true, killedReason: reason});
      return this.#marketSellAll(reason);
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

  #marketSellAll(reason: string): OrderAdvice {
    return {
      side: ExchangeOrderSide.SELL,
      type: ExchangeOrderType.MARKET,
      amount: null,
      amountIn: 'base',
      reason: `[KILL SWITCH] ${reason}`,
    };
  }
}

function isGuardedState(value: unknown): value is GuardedStrategyState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.killed === 'boolean' &&
    (candidate.killedReason === null || typeof candidate.killedReason === 'string') &&
    typeof candidate.totalCostBasis === 'string' &&
    typeof candidate.totalPositionSize === 'string'
  );
}
