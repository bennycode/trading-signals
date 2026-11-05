import type {Candle} from '../../broker/Broker.js';
import type {TradingPair} from '../../broker/TradingPair.js';
import type {TimeSeriesMap} from './api/schema/TimeSeriesSchema.js';

export class AlphaVantageMapper {
  /**
   * Turns a series into candles, oldest first, the order every consumer in this package expects.
   *
   * Daily and weekly bars are keyed by calendar date with no time of day, so each one opens at
   * midnight UTC. That is a label for the session rather than its true opening bell, which differs
   * per venue, so it must not be read as the moment the session started.
   */
  static toCandles(series: TimeSeriesMap, pair: TradingPair, intervalInMillis: number): Candle[] {
    return Object.entries(series)
      .map(([date, bar]) => {
        const openTimeInISO = new Date(`${date}T00:00:00.000Z`).toISOString();
        const candle: Candle = {
          base: pair.base,
          close: bar['4. close'],
          counter: pair.counter,
          high: bar['2. high'],
          low: bar['3. low'],
          open: bar['1. open'],
          openTimeInISO,
          openTimeInMillis: new Date(openTimeInISO).getTime(),
          sizeInMillis: intervalInMillis,
          volume: bar['5. volume'],
        };
        return candle;
      })
      .sort((a, b) => a.openTimeInMillis - b.openTimeInMillis);
  }
}
