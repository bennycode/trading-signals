import {parse as parseDuration} from 'ms';
import type {Candle, MarketDataSource, TradingPair} from '@typedtrader/exchange';
import {ChartHealth, type HealthReport} from 'trading-strategies';

/**
 * The card is read on daily bars, which is the size every period on it is conventionally counted
 * in: a 50- and 200-day average, a 14-day momentum index, a 14-day range, 20-day bands. Offering a
 * bar size would not read the same card on another clock, it would silently redefine every one of
 * those periods, so the CLI does not offer one.
 */
const TIMEFRAME = '1d';

export interface HealthRequest {
  /** Index or sector proxy the relative strength check measures the instrument against. */
  benchmark?: TradingPair | undefined;
  count: number;
}

/**
 * Reads {@link ChartHealth} off a broker's candle history.
 *
 * The benchmark series is matched to the instrument by candle open time rather than by position,
 * because a halt or a late open leaves one of the two feeds a bar short and scoring a stock against
 * the wrong day of its index would be worse than not scoring it at all.
 */
export async function scoreChartHealth(
  broker: Pick<MarketDataSource, 'getRecentCandles'>,
  pair: TradingPair,
  {benchmark, count}: HealthRequest
): Promise<HealthReport> {
  const intervalInMillis = parseDuration(TIMEFRAME);
  const candles = await broker.getRecentCandles(pair, count, intervalInMillis);
  const benchmarkByOpenTime = new Map<number, Candle>();

  if (benchmark) {
    for (const candle of await broker.getRecentCandles(benchmark, count, intervalInMillis)) {
      benchmarkByOpenTime.set(candle.openTimeInMillis, candle);
    }
  }

  const card = new ChartHealth({timeframe: TIMEFRAME});

  for (const candle of candles) {
    card.add(candle, benchmarkByOpenTime.get(candle.openTimeInMillis));
  }

  const report = card.getReport();

  if (!report) {
    throw new Error(
      `Scoring ${pair.base} needs at least ${card.getRequiredBars()} daily candles, but ${candles.length} arrived. Raise --count.`
    );
  }

  return report;
}
