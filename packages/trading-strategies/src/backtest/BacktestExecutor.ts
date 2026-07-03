import Big from 'big.js';
import {CandleBatcher} from '@typedtrader/exchange';
import type {Candle, FeeRate, TradingRules, TradingPair} from '@typedtrader/exchange';
import {AdviceExecutor} from '../trader/AdviceExecutor.js';
import type {OrderAdvice, TradingSessionState} from '../trader/TradingSessionTypes.js';
import type {BacktestConfig} from './BacktestConfig.js';
import type {
  BacktestPerformanceSummary,
  BacktestResult,
  BacktestSkippedAdvice,
  BacktestTrade,
} from './BacktestResult.js';
import {PerformanceCalculator} from './PerformanceCalculator.js';

export class BacktestExecutor {
  readonly #config: BacktestConfig;

  constructor(config: BacktestConfig) {
    this.#config = config;
  }

  async execute(): Promise<BacktestResult> {
    const {broker: exchange, candles, strategy, tradingPair} = this.#config;

    const initialBalances = await exchange.getAvailableBalances(tradingPair);
    const initialBaseBalance = initialBalances.base;
    const initialCounterBalance = initialBalances.counter;

    // Fetch static values once before the loop
    const [tradingRules, feeRates] = await Promise.all([
      exchange.getTradingRules(tradingPair),
      exchange.getFeeRates(tradingPair),
    ]);

    // The exact same advice→order translation a live TradingSession uses
    const adviceExecutor = new AdviceExecutor({broker: exchange, feeRates, pair: tradingPair, tradingRules});

    const trades: BacktestTrade[] = [];
    const skippedAdvices: BacktestSkippedAdvice[] = [];
    let totalFees = new Big(0);

    for (const candle of candles) {
      // Step 1: Match pending orders from previous iteration against this candle
      const fills = exchange.processCandle(candle);

      if (fills.length > 0) {
        for (const fill of fills) {
          trades.push({
            advice: this.#findAdviceForFill(fill.order_id),
            fee: new Big(fill.fee),
            openTimeInISO: fill.created_at,
            price: new Big(fill.price),
            side: fill.side,
            size: new Big(fill.size),
          });
          totalFees = totalFees.plus(fill.fee);

          // Notify strategy of fill so it can update internal state
          if (strategy.onFill) {
            const fillState = await this.#buildState(tradingPair, tradingRules, feeRates);
            await strategy.onFill(fill, fillState);
          }
        }
      }

      // Step 2: Run strategy to get advice (strategies always receive 1-minute candles)
      const batchedCandle = CandleBatcher.createOneMinuteBatchedCandle([candle]);
      const state = await this.#buildState(tradingPair, tradingRules, feeRates);
      const advice = await strategy.onCandle(batchedCandle, state);

      if (!advice) {
        continue;
      }

      // Step 3: Replace outstanding orders with the newest advice, mirroring TradingSession
      const openOrders = await exchange.getOpenOrders(tradingPair);
      if (openOrders.length > 0) {
        await exchange.cancelOpenOrders(tradingPair);
      }

      const outcome = await adviceExecutor.execute(advice);

      if (outcome.status === 'PLACED') {
        this.#orderAdviceMap.set(outcome.order.id, advice);
      } else {
        skippedAdvices.push({
          advice,
          openTimeInISO: candle.openTimeInISO,
          reason: outcome.error.message,
        });
      }
    }

    /*
     * Cancel any orders placed on the last candle that were never filled.
     * This releases their held balances back to available so the final stats
     * correctly reflect what the portfolio actually holds.
     */
    await exchange.cancelOpenOrders(tradingPair);

    const finalBalances = await exchange.getAvailableBalances(tradingPair);
    const firstOpenPrice = candles.length > 0 ? new Big(candles[0].open) : new Big(0);
    const lastClosePrice = candles.length > 0 ? new Big(candles[candles.length - 1].close) : new Big(0);

    const initialPortfolioValue = initialBaseBalance.mul(firstOpenPrice).plus(initialCounterBalance);
    const finalPortfolioValue = finalBalances.base.mul(lastClosePrice).plus(finalBalances.counter);
    const profitOrLoss = finalPortfolioValue.minus(initialPortfolioValue);

    const performance = this.#buildPerformanceSummary(trades, candles, initialPortfolioValue, finalPortfolioValue);

    return {
      finalBaseBalance: finalBalances.base,
      finalCounterBalance: finalBalances.counter,
      initialBaseBalance,
      initialCounterBalance,
      performance,
      profitOrLoss,
      skippedAdvices,
      totalCandles: candles.length,
      totalFees,
      trades,
    };
  }

  /** Map to track which order_id corresponds to which advice */
  readonly #orderAdviceMap = new Map<string, OrderAdvice>();

  #findAdviceForFill(orderId: string): OrderAdvice {
    const advice = this.#orderAdviceMap.get(orderId);
    if (!advice) {
      // Fabricating a fallback advice here would silently corrupt the cycle/win-rate stats
      throw new Error(`No advice recorded for filled order "${orderId}"`);
    }
    return advice;
  }

  async #buildState(pair: TradingPair, tradingRules: TradingRules, feeRates: FeeRate): Promise<TradingSessionState> {
    const {broker: exchange} = this.#config;
    const [balances, fills] = await Promise.all([exchange.getAvailableBalances(pair), exchange.getFills(pair)]);
    const lastOrderSide = fills.length > 0 ? fills[0].side : undefined;

    return {
      baseBalance: balances.base,
      counterBalance: balances.counter,
      feeRates,
      lastOrderSide,
      tradingRules,
    };
  }

  #buildPerformanceSummary(
    trades: BacktestTrade[],
    candles: Candle[],
    initialPortfolioValue: Big,
    finalPortfolioValue: Big
  ): BacktestPerformanceSummary {
    const returnPercentage = initialPortfolioValue.gt(0)
      ? finalPortfolioValue.minus(initialPortfolioValue).div(initialPortfolioValue).mul(100)
      : new Big(0);

    const winRate = PerformanceCalculator.calculateWinRate(trades);
    const buyAndHoldReturnPercentage = PerformanceCalculator.calculateBuyAndHoldReturn(candles);
    const {maxLossStreak, maxWinStreak} = PerformanceCalculator.calculateStreaks(trades);

    return {
      buyAndHoldReturnPercentage,
      finalPortfolioValue,
      initialPortfolioValue,
      maxLossStreak,
      maxWinStreak,
      returnPercentage,
      totalTrades: trades.length,
      winRate,
    };
  }
}
