import type {OpenHighLowCloseVolume} from '../../base/Candle.type.js';

/**
 * Merges consecutive candles into a single candle of a higher timeframe — five 1-minute candles
 * become one 5-minute candle: it opens where the first opened, closes where the last closed,
 * spans the widest range, and carries the combined volume.
 *
 * @throws If no candles are given, because an empty stretch of time has no candle.
 */
export function mergeCandles(candles: readonly OpenHighLowCloseVolume<number>[]): OpenHighLowCloseVolume<number> {
  if (candles.length === 0) {
    throw new Error('Cannot merge an empty series of candles.');
  }

  let high = candles[0].high;
  let low = candles[0].low;
  let volume = 0;

  for (const candle of candles) {
    if (candle.high > high) {
      high = candle.high;
    }

    if (candle.low < low) {
      low = candle.low;
    }

    volume += candle.volume;
  }

  return {
    close: candles[candles.length - 1].close,
    high,
    low,
    open: candles[0].open,
    volume,
  };
}
