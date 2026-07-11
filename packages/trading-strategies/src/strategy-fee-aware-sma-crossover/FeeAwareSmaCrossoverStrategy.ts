import Big from 'big.js';
import {OrderSide, OrderType, calculateRoundTripProfit} from '@typedtrader/exchange';
import type {Fill, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import {
  SmaCrossoverSchema,
  SmaCrossoverStrategy,
  type SmaCrossoverConfig,
} from '../strategy-sma-crossover/SmaCrossoverStrategy.js';

export const FeeAwareSmaCrossoverSchema = SmaCrossoverSchema;
export type FeeAwareSmaCrossoverConfig = SmaCrossoverConfig;

/**
 * An {@link SmaCrossoverStrategy} that refuses to sell at a loss. It trades all-in /
 * all-out — buying and selling the entire balance in one shot — so a single entry price
 * is enough: it remembers the last buy and, when the crossover signals a bearish exit,
 * only forwards the SELL when selling at the current price nets a profit after the taker
 * fee on both legs (see `calculateRoundTripProfit`). Otherwise it holds.
 *
 * Trade-off: skipping unprofitable exits means holding through a downtrend rather than
 * taking a small loss, so pair it with a stop-loss if you need a hard floor.
 */
export class FeeAwareSmaCrossoverStrategy extends SmaCrossoverStrategy {
  static override NAME = '@typedtrader/strategy-fee-aware-sma-crossover';

  /** Price of the most recent BUY fill — the entry the next SELL is measured against. `undefined` while flat. */
  #lastBuyPrice: Big | undefined = undefined;

  async onFill(fill: Fill, _state: TradingSessionState): Promise<void> {
    this.#lastBuyPrice = fill.side === OrderSide.BUY ? new Big(fill.price) : undefined;
  }

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    const advice = await super.processCandle(candle, state);

    // Only gate SELLs; buys and "do nothing" pass straight through.
    if (!advice || advice.side !== OrderSide.SELL) {
      return advice;
    }

    // No known entry to measure against — don't block the exit.
    if (!this.#lastBuyPrice) {
      return advice;
    }

    const profit = calculateRoundTripProfit({
      entryFeeRate: state.feeRates[OrderType.MARKET],
      entryPrice: this.#lastBuyPrice,
      exitFeeRate: state.feeRates[OrderType.MARKET],
      exitPrice: candle.close,
      quantity: state.baseBalance,
    });

    if (!profit.isProfitable) {
      // Selling here would lock in a loss after fees — hold instead.
      return;
    }

    return {
      ...advice,
      reason: `${advice.reason ?? 'SMA bearish cross'}; nets +${profit.netProfitPercent.toFixed(2)}% after fees`,
    };
  }
}
