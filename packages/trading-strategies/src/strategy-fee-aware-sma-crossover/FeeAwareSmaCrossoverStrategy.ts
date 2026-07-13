import {OrderSide, OrderType, calculateRoundTripProfit} from '@typedtrader/exchange';
import type {OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import {
  SmaCrossoverSchema,
  SmaCrossoverStrategy,
  type SmaCrossoverConfig,
} from '../strategy-sma-crossover/SmaCrossoverStrategy.js';

export const FeeAwareSmaCrossoverSchema = SmaCrossoverSchema;
export type FeeAwareSmaCrossoverConfig = SmaCrossoverConfig;

/**
 * An {@link SmaCrossoverStrategy} that refuses to sell at a loss. When the crossover signals
 * a bearish exit, it only forwards the SELL when selling at the current price nets a profit
 * after the taker fee on both legs (see `calculateRoundTripProfit`). Otherwise it holds.
 *
 * The entry it measures against is the base `Strategy`'s fill-tracked last buy price — which,
 * for this all-in / all-out strategy, is the price of the position it currently holds.
 *
 * Trade-off: skipping unprofitable exits means holding through a downtrend rather than
 * taking a small loss, so pair it with a stop-loss if you need a hard floor.
 */
export class FeeAwareSmaCrossoverStrategy extends SmaCrossoverStrategy {
  static override NAME = '@typedtrader/strategy-fee-aware-sma-crossover';

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    const advice = await super.processCandle(candle, state);

    // Only gate SELLs; buys and "do nothing" pass straight through.
    if (!advice || advice.side !== OrderSide.SELL) {
      return advice;
    }

    // No tracked entry to measure against — don't block the exit.
    const entryPrice = this.lastBuyPrice;
    if (!entryPrice) {
      return advice;
    }

    const profit = calculateRoundTripProfit({
      entryFeeRate: state.feeRates[OrderType.MARKET],
      entryPrice,
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
