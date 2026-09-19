import {describe, expect, it} from 'vitest';
import type {Candle, CandleImportRequest} from './Broker.js';
import {getCandlesUntil, MarketDataSource} from './MarketDataSource.js';
import {TradingPair} from './TradingPair.js';

const ONE_DAY = 86_400_000;
const PAIR = new TradingPair('ACME', 'USD');

function candle(openTimeInMillis: number): Candle {
  return {
    base: 'ACME',
    close: '100',
    counter: 'USD',
    high: '101',
    low: '99',
    open: '100',
    openTimeInISO: new Date(openTimeInMillis).toISOString(),
    openTimeInMillis,
    sizeInMillis: ONE_DAY,
    volume: '1',
  };
}

/** Builds `length` candles spaced `spacingInMillis` apart, oldest first. */
function buildDataset(length: number, spacingInMillis: number): Candle[] {
  const base = Date.UTC(2026, 0, 1);
  return Array.from({length}, (_unused, index) => candle(base + index * spacingInMillis));
}

/**
 * Minimal concrete data source: `getCandles` returns the dataset bars inside the requested
 * `[start, end]` window (oldest first, like a real exchange), and records every call so tests can
 * assert how the window widened.
 */
class TestMarketDataSource extends MarketDataSource {
  readonly windows: {startInMillis: number; endInMillis: number}[] = [];
  readonly #dataset: Candle[];

  constructor(dataset: Candle[]) {
    super();
    this.#dataset = dataset;
  }

  async getCandles(_pair: TradingPair, request: CandleImportRequest): Promise<Candle[]> {
    const startInMillis = new Date(request.startTimeFirstCandle).getTime();
    const endInMillis = new Date(request.startTimeLastCandle).getTime();
    this.windows.push({endInMillis, startInMillis});
    return this.#dataset.filter(c => c.openTimeInMillis >= startInMillis && c.openTimeInMillis <= endInMillis);
  }

  async getLatestCandle(): Promise<Candle> {
    return this.#dataset[this.#dataset.length - 1];
  }

  async watchCandles() {
    return 'topic';
  }

  unwatchCandles(): void {}
  disconnect(): void {}
}

describe('MarketDataSource.getRecentCandles', () => {
  it('returns an empty array without touching the network when count <= 0', async () => {
    const source = new TestMarketDataSource(buildDataset(10, ONE_DAY));

    expect(await source.getRecentCandles(PAIR, 0, ONE_DAY)).toEqual([]);
    expect(await source.getRecentCandles(PAIR, -5, ONE_DAY)).toEqual([]);
    expect(source.windows, 'getCandles is never called for a non-positive count').toHaveLength(0);
  });

  it('returns the most recent `count` candles oldest-first in a single window when history is dense', async () => {
    const dataset = buildDataset(100, ONE_DAY);
    const source = new TestMarketDataSource(dataset);

    const result = await source.getRecentCandles(PAIR, 10, ONE_DAY);

    expect(result, 'returns exactly the requested count').toHaveLength(10);
    expect(result, 'returns the newest 10 bars, oldest first').toEqual(dataset.slice(-10));
    expect(source.windows, 'one window covers 10 daily bars').toHaveLength(1);
  });

  it('anchors the window end to the latest real bar, not wall-clock time', async () => {
    const dataset = buildDataset(30, ONE_DAY);
    const latest = dataset[dataset.length - 1];
    const source = new TestMarketDataSource(dataset);

    await source.getRecentCandles(PAIR, 5, ONE_DAY);

    expect(source.windows[0].endInMillis, 'window ends at the latest bar').toBe(latest.openTimeInMillis);
  });

  it('reaches further back when market closures leave the first window short', async () => {
    // Bars exist only every 3rd day (weekends/holidays), so the first window under-fills.
    const dataset = buildDataset(40, ONE_DAY * 3);
    const source = new TestMarketDataSource(dataset);

    const result = await source.getRecentCandles(PAIR, 10, ONE_DAY);

    expect(result, 'still returns the full requested count after widening').toHaveLength(10);
    expect(result, 'and they are the newest 10 bars, oldest first').toEqual(dataset.slice(-10));
    expect(source.windows.length, 'needed more than one window to fill the request').toBeGreaterThan(1);
    const spans = source.windows.map(w => w.endInMillis - w.startInMillis);
    expect(spans[1], 'each window reaches twice as far back as the one before').toBe(spans[0] * 2);
  });

  it('keeps bars that open between two windows when the anchor is not bar-aligned', async () => {
    /*
     * Daily bars open at 05:00 UTC while a backtest can start at any time, here 14:30. The first
     * window reaches back to 2026-02-20T14:30, so the bar opening at 2026-02-20T05:00 sits between
     * that window and the next one.
     */
    const dataset = Array.from({length: 30}, (_unused, index) => candle(Date.UTC(2026, 0, 1, 5) + index * ONE_DAY * 2));
    const source = new TestMarketDataSource(dataset);
    const anchorInMillis = Date.UTC(2026, 2, 2, 14, 30);
    const expected = dataset.filter(bar => bar.openTimeInMillis <= anchorInMillis).slice(-10);

    const result = await getCandlesUntil(source, PAIR, 10, ONE_DAY, anchorInMillis);

    expect(
      result.map(bar => bar.openTimeInISO),
      'no bar may fall into a gap between two windows'
    ).toEqual(expected.map(bar => bar.openTimeInISO));
  });

  it('collects older windows instead of re-fetching a wider one', async () => {
    const dataset = buildDataset(40, ONE_DAY * 3);
    const source = new TestMarketDataSource(dataset);

    await source.getRecentCandles(PAIR, 10, ONE_DAY);

    const overlapping = source.windows.filter(
      (window, index) => index > 0 && window.endInMillis >= source.windows[index - 1].startInMillis
    );
    expect(overlapping, 'each window ends before the previous one starts, so no candle is fetched twice').toEqual([]);
  });

  it('returns whatever history exists when the instrument is younger than `count`', async () => {
    const dataset = buildDataset(4, ONE_DAY);
    const source = new TestMarketDataSource(dataset);

    const result = await source.getRecentCandles(PAIR, 10, ONE_DAY);

    expect(result, 'never invents bars — caps at available history').toEqual(dataset);
  });
});
