import type {Candle} from '../../broker/Broker.js';
import type {TradingPair} from '../../broker/TradingPair.js';
import type {EodBar} from './api/schema/EodSchema.js';

export class EODHDMapper {
  /**
   * Turns end-of-day bars into candles, oldest first.
   *
   * The closing price is the as-traded one. `adjusted_close` is tempting but unusable here: it is
   * recalculated every time a dividend lands, so the same historical candle would change value
   * between two runs.
   *
   * Each bar is a calendar day with no time of day, so the candle opens at midnight UTC. That marks
   * which session the bar belongs to rather than when trading actually began.
   */
  static toCandles(bars: EodBar[], pair: TradingPair, intervalInMillis: number): Candle[] {
    return bars
      .map(bar => {
        const openTimeInISO = new Date(`${bar.date}T00:00:00.000Z`).toISOString();
        const candle: Candle = {
          base: pair.base,
          close: `${bar.close}`,
          counter: pair.counter,
          high: `${bar.high}`,
          low: `${bar.low}`,
          open: `${bar.open}`,
          openTimeInISO,
          openTimeInMillis: new Date(openTimeInISO).getTime(),
          sizeInMillis: intervalInMillis,
          volume: `${bar.volume}`,
        };
        return candle;
      })
      .sort((a, b) => a.openTimeInMillis - b.openTimeInMillis);
  }
}
