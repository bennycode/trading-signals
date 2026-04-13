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
 * multiple buys and partial sells correctly. Once a guard fires, the strategy is
 * permanently killed for this session and all subsequent candles return `void`.
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

  /** Read-only snapshot of the current guard state. Useful for tests and diagnostics. */
  get guardState(): Readonly<GuardedStrategyState> {
    return {...this.#guardState};
  }

  /**
   * Short-circuits to `undefined` once a guard has fired. Subclasses are never
   * called again for this session — the kill switch is terminal.
   */
  override async onCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    this.lastBatchedCandle = candle;

    if (this.#guardState.killed) {
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
    const guardState = this.#guardState;

    const positionSize = new Big(guardState.totalPositionSize);
    if (positionSize.lte(0)) {
      return;
    }

    if (!this.#stopLossPct && !this.#takeProfitPct) {
      return;
    }

    const avgEntry = new Big(guardState.totalCostBasis).div(positionSize);
    const currentPrice = candle.close;
    const pctChange = currentPrice.minus(avgEntry).div(avgEntry).mul(100);

    if (this.#stopLossPct && pctChange.lte(this.#stopLossPct.neg())) {
      const reason = `Stop-loss: ${pctChange.toFixed(2)}% <= -${this.#stopLossPct.toFixed(2)}%`;
      guardState.killed = true;
      guardState.killedReason = reason;
      return this.#marketSellAll(reason);
    }

    if (this.#takeProfitPct && pctChange.gte(this.#takeProfitPct)) {
      const reason = `Take-profit: +${pctChange.toFixed(2)}% >= +${this.#takeProfitPct.toFixed(2)}%`;
      guardState.killed = true;
      guardState.killedReason = reason;
      return this.#marketSellAll(reason);
    }
  }

  async onFill(fill: ExchangeFill, _state: TradingSessionState): Promise<void> {
    const guardState = this.#guardState;
    const fillPrice = new Big(fill.price);
    const fillSize = new Big(fill.size);

    if (fill.side === ExchangeOrderSide.BUY) {
      const currentCostBasis = new Big(guardState.totalCostBasis);
      const currentPositionSize = new Big(guardState.totalPositionSize);
      guardState.totalCostBasis = currentCostBasis.plus(fillPrice.mul(fillSize)).toFixed();
      guardState.totalPositionSize = currentPositionSize.plus(fillSize).toFixed();
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
      guardState.totalCostBasis = '0';
      guardState.totalPositionSize = '0';
      return;
    }

    guardState.totalCostBasis = avgEntry.mul(newPositionSize).toFixed();
    guardState.totalPositionSize = newPositionSize.toFixed();
  }

  override restoreState(persisted: Record<string, unknown>): void {
    const existing = persisted[GUARD_STATE_KEY];
    const restoredGuard: GuardedStrategyState = isGuardedState(existing) ? existing : defaultGuardState();

    super.restoreState({
      ...persisted,
      [GUARD_STATE_KEY]: restoredGuard,
    });

    // The base class only updates `#_state`; the proxied state still points at
    // the original object from the constructor. Copy restored values into the
    // proxy so subsequent reads via `getProxiedState()` see them.
    const proxiedGuard = this.#guardState;
    proxiedGuard.killed = restoredGuard.killed;
    proxiedGuard.killedReason = restoredGuard.killedReason;
    proxiedGuard.totalCostBasis = restoredGuard.totalCostBasis;
    proxiedGuard.totalPositionSize = restoredGuard.totalPositionSize;
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
