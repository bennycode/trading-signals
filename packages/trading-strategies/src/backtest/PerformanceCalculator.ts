import Big from 'big.js';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {ExchangeOrderSide} from '@typedtrader/exchange';
import type {BacktestTrade} from './BacktestResult.js';

export class PerformanceCalculator {
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
  static calculateBuyAndHoldReturn(candles: ExchangeCandle[]): Big {
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

    return {maxWinStreak, maxLossStreak};
  }

  static #buildCycles(trades: BacktestTrade[]): {buyAvgPrice: Big; sellAvgPrice: Big}[] {
    const cycles: {buyAvgPrice: Big; sellAvgPrice: Big}[] = [];
    let pendingBuys: BacktestTrade[] = [];

    for (const trade of trades) {
      if (trade.side === ExchangeOrderSide.BUY) {
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
}
