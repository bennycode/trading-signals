import {ms} from 'ms';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TradingPair} from '../../broker/TradingPair.js';
import type {EODHDAPI} from './api/EODHDAPI.js';

const mockMethods = {
  getEod: vi.fn<EODHDAPI['getEod']>(),
};

/*
 * The real module loads alongside the stub, because `EODHDMarketData.toPeriod` returns the
 * `EODHDPeriod` values from it and replacing the whole module would leave them undefined.
 */
vi.mock(import('./api/EODHDAPI.js'), async importActual => {
  const actual = await importActual();
  return {
    ...actual,
    EODHDAPI: class {
      getEod = mockMethods.getEod;
    } as unknown as typeof EODHDAPI,
  };
});

// Import after mocking
const {EODHDMarketData} = await import('./EODHDMarketData.js');

/** Oldest first, the order EODHD answers in. */
const EOD_BARS = [
  {adjusted_close: 130.2, close: 130.2, date: '2026-10-23', high: 130.6, low: 129.1, open: 129.5, volume: 700},
  {adjusted_close: 131, close: 131, date: '2026-10-26', high: 131.4, low: 129.9, open: 130.2, volume: 800},
  {adjusted_close: 131.605, close: 131.605, date: '2026-10-27', high: 132.1, low: 130.8, open: 131, volume: 900},
];

const PAIR = new TradingPair('EUNL.XETRA', 'EUR');
const WINDOW = {
  intervalInMillis: ms('1d'),
  startTimeFirstCandle: '2026-10-23T00:00:00.000Z',
  startTimeLastCandle: '2026-10-27T00:00:00.000Z',
};

function createMarketData(historyFrom?: string) {
  return new EODHDMarketData({apiKey: 'test-key', historyFrom});
}

// Sequential: every test drives the one shared `getEod` stub, which concurrent runs would interleave.
describe('EODHDMarketData', {concurrent: false}, () => {
  beforeEach(() => {
    mockMethods.getEod.mockReset();
    mockMethods.getEod.mockResolvedValue([...EOD_BARS]);
  });

  describe('getCandles', () => {
    it('maps bars onto candles with the pair and interval attached', async () => {
      const candles = await createMarketData().getCandles(PAIR, WINDOW);

      expect(candles[0]).toEqual({
        base: 'EUNL.XETRA',
        close: '130.2',
        counter: 'EUR',
        high: '130.6',
        low: '129.1',
        open: '129.5',
        openTimeInISO: '2026-10-23T00:00:00.000Z',
        openTimeInMillis: 1792713600000,
        sizeInMillis: ms('1d'),
        volume: '700',
      });
    });

    it('keeps the as-traded close rather than the adjusted one', async () => {
      mockMethods.getEod.mockResolvedValue([
        {adjusted_close: 99.9, close: 130.2, date: '2026-10-23', high: 130.6, low: 129.1, open: 129.5, volume: 700},
      ]);

      const candles = await createMarketData().getCandles(PAIR, WINDOW);

      expect(candles[0]?.close, 'the adjusted close is recomputed on every dividend, so it is not stable').toBe(
        '130.2'
      );
    });

    it('drops candles outside the requested window', async () => {
      const candles = await createMarketData().getCandles(PAIR, {
        ...WINDOW,
        startTimeFirstCandle: '2026-10-26T00:00:00.000Z',
        startTimeLastCandle: '2026-10-26T00:00:00.000Z',
      });

      expect(candles.map(candle => candle.close)).toEqual(['131']);
    });

    it('fetches an instrument once, because the free plan allows 20 requests a day', async () => {
      const marketData = createMarketData();

      await marketData.getCandles(PAIR, WINDOW);
      await marketData.getCandles(PAIR, {...WINDOW, startTimeFirstCandle: '2026-01-01T00:00:00.000Z'});

      expect(mockMethods.getEod).toHaveBeenCalledTimes(1);
    });

    it('does not cache a failed fetch, so a rate limit is recoverable', async () => {
      const marketData = createMarketData();
      mockMethods.getEod.mockRejectedValueOnce(new Error('rate limit'));

      await expect(marketData.getCandles(PAIR, WINDOW)).rejects.toThrow('rate limit');
      const candles = await marketData.getCandles(PAIR, WINDOW);

      expect(candles.length, 'the retry reaches the API instead of a cached rejection').toBe(3);
    });

    it('passes the history floor through so the payload can be trimmed', async () => {
      await createMarketData('2026-01-01').getCandles(PAIR, WINDOW);

      expect(mockMethods.getEod).toHaveBeenCalledWith({from: '2026-01-01', period: 'd', symbol: 'EUNL.XETRA'});
    });

    it('asks for weekly bars when the interval is a week', async () => {
      await createMarketData().getCandles(PAIR, {...WINDOW, intervalInMillis: ms('7d')});

      expect(mockMethods.getEod).toHaveBeenCalledWith(expect.objectContaining({period: 'w'}));
    });
  });

  describe('getLatestCandle', () => {
    it('returns the newest candle', async () => {
      const candle = await createMarketData().getLatestCandle(PAIR, ms('1d'));

      expect(candle.openTimeInISO).toBe('2026-10-27T00:00:00.000Z');
      expect(candle.close).toBe('131.605');
    });

    it('names the renamed-ticker case when the series is empty', async () => {
      mockMethods.getEod.mockResolvedValue([]);

      await expect(createMarketData().getLatestCandle(PAIR, ms('1d'))).rejects.toThrow(/renamed ticker/);
    });
  });

  describe('toPeriod', () => {
    it('maps the daily interval', () => {
      expect(EODHDMarketData.toPeriod(ms('1d'))).toBe('d');
    });

    it('maps the weekly interval', () => {
      expect(EODHDMarketData.toPeriod(ms('7d'))).toBe('w');
    });

    it('refuses an interval it has no period for', () => {
      expect(() => EODHDMarketData.toPeriod(ms('1m'))).toThrow(/EODHD serves daily .* and weekly .* candles here/);
    });
  });

  describe('watchCandles', () => {
    it('rejects because EODHD publishes no candle stream', async () => {
      await expect(createMarketData().watchCandles()).rejects.toThrow('publishes no candle stream');
    });
  });

  describe('disconnect', () => {
    it('clears the cache so a later call fetches again', async () => {
      const marketData = createMarketData();

      await marketData.getCandles(PAIR, WINDOW);
      marketData.disconnect();
      await marketData.getCandles(PAIR, WINDOW);

      expect(mockMethods.getEod).toHaveBeenCalledTimes(2);
    });
  });
});
