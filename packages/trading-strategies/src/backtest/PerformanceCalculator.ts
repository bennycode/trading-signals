import Big from 'big.js';
import type {Candle} from '@typedtrader/exchange';
import {OrderSide} from '@typedtrader/exchange';
import type {BacktestTrade} from './BacktestResult.js';

export class PerformanceCalculator {
  /**
   * Calculates the unannualized Sharpe ratio from consecutive portfolio equity returns.
   */
  static calculateSharpeRatio(equityCurve: readonly Big[]): Big {
    const returns = PerformanceCalculator.#calculateReturns(equityCurve);
    if (returns.length === 0) {
      return new Big(0);
    }

    const mean = PerformanceCalculator.#mean(returns);
    const variance = returns.reduce((sum, value) => sum.plus(value.minus(mean).pow(2)), new Big(0)).div(returns.length);
    return variance.eq(0) ? new Big(0) : mean.div(variance.sqrt());
  }

  /**
   * Calculates the unannualized Sortino ratio using zero as the target return.
   */
  static calculateSortinoRatio(equityCurve: readonly Big[]): Big {
    const returns = PerformanceCalculator.#calculateReturns(equityCurve);
    if (returns.length === 0) {
      return new Big(0);
    }

    const downsideVariance = returns
      .reduce((sum, value) => sum.plus(value.lt(0) ? value.pow(2) : 0), new Big(0))
      .div(returns.length);
    return downsideVariance.eq(0) ? new Big(0) : PerformanceCalculator.#mean(returns).div(downsideVariance.sqrt());
  }

  /**
   * Calculates the largest peak-to-trough portfolio decline as a positive percentage.
   */
  static calculateMaxDrawdown(equityCurve: readonly Big[]): Big {
    let peak: Big | undefined;
    let maxDrawdown = new Big(0);

    for (const value of equityCurve) {
      if (!peak || value.gt(peak)) {
        peak = value;
      }
      if (peak.gt(0)) {
        const drawdown = peak.minus(value).div(peak);
        if (drawdown.gt(maxDrawdown)) {
          maxDrawdown = drawdown;
        }
      }
    }

    return maxDrawdown.mul(100);
  }

  /**
   * Calculates win rate by pairing buy trades with subsequent sell trades into round-trip cycles.
   * A cycle is "won" when the volume-weighted average sell price exceeds the volume-weighted average buy price.
   */
  static calculateWinRate(trades: BacktestTrade[]): Big {
    const cycles = PerformanceCalculator.#buildCycles(trades);

    if (cycles.length === 0) {
      return new Big(0);
    }

    const wins = cycles.filter(c => c.sellAvgPrice.gt(c.buyAvgPrice)).length;
    return new Big(wins).div(cycles.length).mul(100);
  }

  /**
   * Calculates buy-and-hold return: percentage change from first candle's close to last candle's close.
   */
  static calculateBuyAndHoldReturn(candles: Candle[]): Big {
    if (candles.length < 2) {
      return new Big(0);
    }

    const firstClose = new Big(candles[0].close);
    const lastClose = new Big(candles[candles.length - 1].close);

    if (firstClose.eq(0)) {
      return new Big(0);
    }

    return lastClose.minus(firstClose).div(firstClose).mul(100);
  }

  /**
   * Calculates the longest consecutive win and loss streaks based on round-trip cycles.
   */
  static calculateStreaks(trades: BacktestTrade[]): {maxWinStreak: number; maxLossStreak: number} {
    const cycles = PerformanceCalculator.#buildCycles(trades);

    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    for (const cycle of cycles) {
      if (cycle.sellAvgPrice.gt(cycle.buyAvgPrice)) {
        currentWinStreak++;
        currentLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      }
    }

    return {maxLossStreak, maxWinStreak};
  }

  static #buildCycles(trades: BacktestTrade[]): {buyAvgPrice: Big; sellAvgPrice: Big}[] {
    const cycles: {buyAvgPrice: Big; sellAvgPrice: Big}[] = [];
    let pendingBuys: BacktestTrade[] = [];

    for (const trade of trades) {
      if (trade.side === OrderSide.BUY) {
        pendingBuys.push(trade);
      } else if (pendingBuys.length > 0) {
        const totalBuySize = pendingBuys.reduce((s, t) => s.plus(t.size), new Big(0));
        const buyAvgPrice = pendingBuys.reduce((s, t) => s.plus(t.price.mul(t.size)), new Big(0)).div(totalBuySize);

        cycles.push({
          buyAvgPrice,
          sellAvgPrice: trade.price,
        });

        pendingBuys = [];
      }
    }

    return cycles;
  }

  static #calculateReturns(equityCurve: readonly Big[]): Big[] {
    const returns: Big[] = [];
    for (let index = 1; index < equityCurve.length; index++) {
      const previous = equityCurve[index - 1];
      if (previous.eq(0)) {
        continue;
      }
      returns.push(equityCurve[index].minus(previous).div(previous));
    }
    return returns;
  }

  static #mean(values: readonly Big[]): Big {
    return values.reduce((sum, value) => sum.plus(value), new Big(0)).div(values.length);
  }
}
