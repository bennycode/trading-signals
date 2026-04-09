import Big from 'big.js';
import type {ExchangeCandle} from '@typedtrader/exchange';
import {ATR} from 'trading-signals';

const ONE_DAY_IN_MS = 86_400_000;

/**
 * Aggregates sub-daily candles into daily OHLCV bars so that ATR reflects
 * the full trading-day range rather than individual minute/hour ranges.
 *
 * The input does not need to be chronologically ordered — each day's bars
 * are sorted by `openTimeInMillis` before deriving open/close, and the
 * returned daily candles are ordered from oldest to newest.
 */
function aggregateToDailyCandles(candles: ExchangeCandle[]): ExchangeCandle[] {
  const dayMap = new Map<string, ExchangeCandle[]>();

  for (const candle of candles) {
    const dayKey = candle.openTimeInISO.slice(0, 10);
    let bucket = dayMap.get(dayKey);
    if (!bucket) {
      bucket = [];
      dayMap.set(dayKey, bucket);
    }
    bucket.push(candle);
  }

  const sortedDayEntries = Array.from(dayMap.entries()).sort(([dayA], [dayB]) => dayA.localeCompare(dayB));

  const daily: ExchangeCandle[] = [];

  for (const [, bars] of sortedDayEntries) {
    const sortedBars = [...bars].sort((a, b) => a.openTimeInMillis - b.openTimeInMillis);
    const first = sortedBars[0];
    const last = sortedBars[sortedBars.length - 1];
    let high = parseFloat(first.high);
    let low = parseFloat(first.low);
    let volume = 0;

    for (const bar of sortedBars) {
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      if (h > high) high = h;
      if (l < low) low = l;
      volume += parseFloat(bar.volume);
    }

    daily.push({
      base: first.base,
      close: last.close,
      counter: first.counter,
      high: String(high),
      low: String(low),
      open: first.open,
      openTimeInISO: first.openTimeInISO,
      openTimeInMillis: first.openTimeInMillis,
      sizeInMillis: ONE_DAY_IN_MS,
      volume: String(volume),
    });
  }

  return daily;
}

/**
 * Suggests a scalp offset based on the Average True Range (ATR) of recent candles.
 * Returns daily ATR * 0.2 — calibrated for high fill rates with solid per-trade margin.
 *
 * Sub-daily candles (1-min, 1-hour, etc.) are automatically aggregated to daily bars
 * before computing ATR, so the offset always reflects daily-scale volatility regardless
 * of the input candle interval.
 *
 * @param candles - Historical candles (any interval; at least `atrPeriod` trading days)
 * @param atrPeriod - ATR smoothing period (default: 14)
 */
export function suggestScalpOffset(candles: ExchangeCandle[], atrPeriod: number = 14): Big {
  const isSubDaily = candles.length > 0 && candles[0].sizeInMillis < ONE_DAY_IN_MS;
  const effectiveCandles = isSubDaily ? aggregateToDailyCandles(candles) : candles;

  if (effectiveCandles.length < atrPeriod) {
    throw new Error(`Need at least ${atrPeriod} trading days to compute ATR, got ${effectiveCandles.length}`);
  }

  const atr = new ATR(atrPeriod);

  for (const candle of effectiveCandles) {
    atr.add({
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
    });
  }

  const atrValue = atr.getResultOrThrow();

  return new Big(atrValue).times(0.2);
}
