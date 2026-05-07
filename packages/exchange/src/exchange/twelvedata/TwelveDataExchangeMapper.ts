import {IntervalEnum, type TimeSeriesItem} from '@twelvedata/twelvedata-node';
import type {ExchangeCandle} from '../Exchange.js';
import type {TradingPair} from '../TradingPair.js';

/**
 * Twelve Data's `interval` query parameter is a string enum, not milliseconds.
 *
 * @see https://twelvedata.com/docs#time-series
 */
const intervalByMillis = new Map<number, IntervalEnum>([
  [60_000, IntervalEnum._1MIN],
  [300_000, IntervalEnum._5MIN],
  [900_000, IntervalEnum._15MIN],
  [1_800_000, IntervalEnum._30MIN],
  [2_700_000, IntervalEnum._45MIN],
  [3_600_000, IntervalEnum._1H],
  [7_200_000, IntervalEnum._2H],
  [14_400_000, IntervalEnum._4H],
  [86_400_000, IntervalEnum._1DAY],
  [604_800_000, IntervalEnum._1WEEK],
]);

export class TwelveDataExchangeMapper {
  static millisToInterval(intervalInMillis: number) {
    const interval = intervalByMillis.get(intervalInMillis);
    if (!interval) {
      throw new Error(`Twelve Data does not support an interval of ${intervalInMillis}ms.`);
    }
    return interval;
  }

  /**
   * Twelve Data returns intraday `datetime` as `YYYY-MM-DD HH:MM:SS` and daily as `YYYY-MM-DD`,
   * both in the timezone passed via the `timezone` query param (we always pass `UTC`).
   */
  static toCandle(item: TimeSeriesItem, pair: TradingPair, intervalInMillis: number): ExchangeCandle {
    const openTimeInISO = item.datetime.includes(' ')
      ? `${item.datetime.replace(' ', 'T')}.000Z`
      : `${item.datetime}T00:00:00.000Z`;

    return {
      base: pair.base,
      close: item.close,
      counter: pair.counter,
      high: item.high,
      low: item.low,
      open: item.open,
      openTimeInISO,
      openTimeInMillis: Date.parse(openTimeInISO),
      sizeInMillis: intervalInMillis,
      volume: item.volume ?? '0',
    };
  }
}
