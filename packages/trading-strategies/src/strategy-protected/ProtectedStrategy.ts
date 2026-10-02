import Big from 'big.js';
import {z} from 'zod';
import {getFilledBaseAmount, OrderSide, OrderType} from '@typedtrader/exchange';
import {AllAvailableAmount} from '../trader/index.js';
import type {Fill, PendingOrder, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {LimitOrderAdvice, OrderAdvice, TradingSessionState} from '../trader/index.js';
import {MarketType} from '../strategy/MarketType.js';
import {Strategy} from '../strategy/Strategy.js';
import {positiveNumberString} from '../util/validators.js';
import {guardReason, guardTargetPrice, isGuardTriggered, parseGuard, type Guard, type GuardOrderType} from './guard.js';

/**
 * All kill-switch settings live under a single nested `protected` key so they can't
 * collide with the subclass's own config fields.
 */
export const ProtectedConfigSchema = z.object({
  /**
   * When `true`, the strategy seeds its position tracking from the account's existing
   * base balance and the first candle's close price. This allows attaching guard
   * protection to a position that was opened externally (manual trade, another strategy).
   * Percentage and nominal guards will be relative to the price at attach time.
   */
  seedFromBalance: z.boolean().default(false),
  /**
   * Stop-loss as an absolute unrealized loss in counter currency. "10" on a 10-share
   * position bought at $100 → fires at $99 (unrealized loss = $10). Mutually exclusive
   * with `stopLossPct` and `stopLossPrice`.
   */
  stopLossNominal: positiveNumberString.optional(),
  /**
   * Order type used to execute the stop-loss kill switch. `"limit"` (default) places a
   * limit sell at the nominal target price — guaranteed exit price, but may not fill if
   * the market gaps past the target. `"market"` places a market sell at the candle where
   * the guard trips — guaranteed fill, but exit price depends on the market.
   */
  stopLossOrder: z.enum(['limit', 'market']).default('limit'),
  /**
   * Stop-loss as a percentage of avg entry. "5" = sell everything at avgEntry * 0.95.
   * Mutually exclusive with `stopLossNominal` and `stopLossPrice`. Omit all three to
   * disable the stop-loss guard.
   */
  stopLossPct: positiveNumberString.optional(),
  /**
   * Stop-loss as an absolute price target. "95" → fires as soon as the candle close
   * drops to $95 or below, placing a limit sell at $95. Mutually exclusive with
   * `stopLossPct` and `stopLossNominal`.
   */
  stopLossPrice: positiveNumberString.optional(),
  /**
   * Take-profit as an absolute unrealized gain in counter currency. "10" on a 10-share
   * position bought at $100 → fires at $101 (unrealized gain = $10). Mutually exclusive
   * with `takeProfitPct` and `takeProfitPrice`.
   */
  takeProfitNominal: positiveNumberString.optional(),
  /**
   * Order type used to execute the take-profit kill switch. See `stopLossOrder` for the
   * trade-off between `"limit"` (default) and `"market"`.
   */
  takeProfitOrder: z.enum(['limit', 'market']).default('limit'),
  /**
   * Take-profit as a percentage of avg entry. "10" = sell everything at avgEntry * 1.10.
   * Mutually exclusive with `takeProfitNominal` and `takeProfitPrice`. Omit all three to
   * disable the take-profit guard.
   */
  takeProfitPct: positiveNumberString.optional(),
  /**
   * Take-profit as an absolute price target. "105" → fires as soon as the candle close
   * reaches $105 or above, placing a limit sell at $105. Mutually exclusive with
   * `takeProfitPct` and `takeProfitNominal`.
   */
  takeProfitPrice: positiveNumberString.optional(),
});

/** All of the kill-switch settings, nested under a single namespaced `protected` key. */
export const ProtectedStrategySchema = z.object({
  protected: ProtectedConfigSchema.optional(),
});

export type ProtectedConfig = z.infer<typeof ProtectedConfigSchema>;
export type ProtectedStrategyConfig = z.infer<typeof ProtectedStrategySchema>;

function isValidBigString(value: string) {
  try {
    new Big(value);
    return true;
  } catch {
    return false;
  }
}

const bigString = z.string().refine(isValidBigString);

/**
 * Persisted state is validated on restore. Besides the shape, a killed state must be
 * fully specified so the retry path in `onCandle` can re-emit the correct advice: a
 * `killed=true` state without `killedOrderType` would leave an open position with no
 * further exit, and a limit kill needs its `killedLimitPrice`. Invalid state falls back
 * to the default, re-arming the guards on the next candle.
 */
const ProtectedStrategyStateSchema = z
  .object({
    killed: z.boolean(),
    /** Limit price of the kill-switch sell order. `null` for market orders or until a guard fires. */
    killedLimitPrice: bigString.nullable(),
    /** Order type used when a guard fires. `null` until a guard fires. */
    killedOrderType: z.enum(['limit', 'market']).nullable(),
    killedReason: z.string().nullable(),
    /** Cumulative cost basis across all BUY fills: sum of (price * size). */
    totalCostBasis: bigString,
    /** Net base quantity held (BUYs minus SELLs). */
    totalPositionSize: bigString,
  })
  .refine(
    state =>
      !state.killed ||
      (state.killedOrderType !== null && (state.killedOrderType !== 'limit' || state.killedLimitPrice !== null))
  );

export type ProtectedStrategyState = z.infer<typeof ProtectedStrategyStateSchema>;

const PROTECTED_STATE_KEY = 'protected';

const defaultProtectedState = (): ProtectedStrategyState => ({
  killed: false,
  killedLimitPrice: null,
  killedOrderType: null,
  killedReason: null,
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
export class ProtectedStrategy extends Strategy {
  static override NAME = '@typedtrader/strategy-protected';
  static override marketTypes: readonly MarketType[] = [MarketType.UTILITY];
  readonly #guards: Guard[];
  readonly #seedFromBalance: boolean;

  constructor(options: {config: Record<string, unknown>; state?: Record<string, unknown>} = {config: {}}) {
    super({
      config: options.config,
      state: {
        ...options.state,
        [PROTECTED_STATE_KEY]: defaultProtectedState(),
      },
    });

    // Parse only the nested `protected` sub-object — the subclass owns the rest of the config.
    const protectedConfig = ProtectedConfigSchema.parse(options.config[PROTECTED_STATE_KEY] ?? {});

    this.#guards = [
      parseGuard(
        'stopLoss',
        {
          nominal: protectedConfig.stopLossNominal,
          pct: protectedConfig.stopLossPct,
          price: protectedConfig.stopLossPrice,
        },
        protectedConfig.stopLossOrder
      ),
      parseGuard(
        'takeProfit',
        {
          nominal: protectedConfig.takeProfitNominal,
          pct: protectedConfig.takeProfitPct,
          price: protectedConfig.takeProfitPrice,
        },
        protectedConfig.takeProfitOrder
      ),
    ].filter(guard => guard !== null);
    this.#seedFromBalance = protectedConfig.seedFromBalance;
  }

  get #protectedState(): ProtectedStrategyState {
    return this.getProxiedState<ProtectedContainerState>()[PROTECTED_STATE_KEY];
  }

  /**
   * `setState` merges top-level keys only, so the nested `protected` object is merged
   * here before being swapped in wholesale.
   */
  #setProtectedState(patch: Partial<ProtectedStrategyState>): void {
    this.setState<ProtectedContainerState>({
      [PROTECTED_STATE_KEY]: {...this.#protectedState, ...patch},
    });
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
  override async onCandle(candle: OneMinuteBatchedCandle, state: TradingSessionState): Promise<OrderAdvice | void> {
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
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    if (this.#guards.length === 0) {
      return;
    }

    let positionSize = new Big(this.#protectedState.totalPositionSize);

    if (positionSize.lte(0) && this.#seedFromBalance && state.baseBalance.gt(0)) {
      const seedSize = state.baseBalance;
      const seedCost = candle.close.mul(seedSize);
      this.#setProtectedState({
        totalCostBasis: seedCost.toFixed(),
        totalPositionSize: seedSize.toFixed(),
      });
      positionSize = seedSize;
    }

    if (positionSize.lte(0)) {
      return;
    }

    const avgEntry = new Big(this.#protectedState.totalCostBasis).div(positionSize);
    const currentPrice = candle.close;

    for (const guard of this.#guards) {
      const targetPrice = guardTargetPrice(guard, avgEntry, positionSize);
      if (isGuardTriggered(guard, currentPrice, targetPrice)) {
        const {orderType} = guard;
        const reason = guardReason(guard, avgEntry, currentPrice, positionSize, targetPrice);
        this.#setProtectedState({
          killed: true,
          killedLimitPrice: orderType === 'limit' ? targetPrice.toFixed() : null,
          killedOrderType: orderType,
          killedReason: reason,
        });
        return this.#killSwitchAdvice(reason, orderType, orderType === 'limit' ? targetPrice : null);
      }
    }
  }

  async onFill(fill: Fill, _state: TradingSessionState): Promise<void> {
    const protectedState = this.#protectedState;
    const fillPrice = new Big(fill.price);
    const executedSize = new Big(fill.size);
    const receivedSize = getFilledBaseAmount(fill);

    if (fill.side === OrderSide.BUY) {
      const newCostBasis = new Big(protectedState.totalCostBasis).plus(fillPrice.mul(executedSize));
      const newPositionSize = new Big(protectedState.totalPositionSize).plus(receivedSize);
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
    const newPositionSize = currentPositionSize.minus(receivedSize);

    if (newPositionSize.lte(0)) {
      this.#setProtectedState({totalCostBasis: '0', totalPositionSize: '0'});
      return;
    }

    this.#setProtectedState({
      totalCostBasis: avgEntry.mul(newPositionSize).toFixed(),
      totalPositionSize: newPositionSize.toFixed(),
    });
  }

  /**
   * Fires `onFinish` when the session reports that a SELL order of ours has fully filled
   * while the kill switch is active. While `killed === true` the subclass cannot place
   * new orders, so any SELL the session has in flight is necessarily the kill-switch sell.
   */
  async onOrderFilled(order: PendingOrder, _state: TradingSessionState): Promise<void> {
    if (this.#protectedState.killed && order.side === OrderSide.SELL) {
      await this.onFinish?.();
    }
  }

  override restoreState(persisted: Record<string, unknown>): void {
    const parsed = ProtectedStrategyStateSchema.safeParse(persisted[PROTECTED_STATE_KEY]);
    const restoredProtected = parsed.success ? parsed.data : defaultProtectedState();

    super.restoreState({
      ...persisted,
      [PROTECTED_STATE_KEY]: restoredProtected,
    });

    /*
     * The base class only updates the persisted snapshot; the proxied state still
     * points at the original object from the constructor. Writing the restored
     * values via `setState` propagates them into the proxied state as well.
     */
    this.#setProtectedState(restoredProtected);
  }

  #killSwitchAdvice(reason: string, orderType: GuardOrderType, limitPrice: Big | null): OrderAdvice {
    if (orderType === 'market') {
      return {
        amount: AllAvailableAmount,
        amountIn: 'base',
        reason: `[KILL SWITCH] ${reason}`,
        side: OrderSide.SELL,
        type: OrderType.MARKET,
      };
    }
    if (!limitPrice) {
      throw new Error('ProtectedStrategy: limit order type requires a limit price');
    }
    const advice: LimitOrderAdvice = {
      amount: AllAvailableAmount,
      amountIn: 'base',
      price: limitPrice,
      reason: `[KILL SWITCH] ${reason}`,
      side: OrderSide.SELL,
      type: OrderType.LIMIT,
    };
    return advice;
  }
}
