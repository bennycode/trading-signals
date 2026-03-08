import Big from 'big.js';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {ATR} from 'trading-signals';

/**
 * Suggests a scalp offset based on the Average True Range (ATR) of recent candles.
 * Returns ATR * 0.5 — aggressive enough to fill frequently, wide enough to cover spread.
 *
 * @param candles - Historical candles (e.g., last week of 1-hour candles)
 * @param atrPeriod - ATR smoothing period (default: 14)
 */
export function suggestScalpOffset(candles: ExchangeCandle[], atrPeriod: number = 14): Big {
  if (candles.length < atrPeriod) {
    throw new Error(`Need at least ${atrPeriod} candles to compute ATR, got ${candles.length}`);
  }

  const atr = new ATR(atrPeriod);

  for (const candle of candles) {
    atr.add({
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
    });
  }

  const atrValue = atr.getResultOrThrow();

  return new Big(atrValue).times(0.5);
}
