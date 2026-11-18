import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TradingPair} from '../TradingPair.js';
import type {IbkrAPI} from './api/IbkrAPI.js';

const mockMethods = {
  getHistory: vi.fn<IbkrAPI['getHistory']>(),
  searchContracts: vi.fn<IbkrAPI['searchContracts']>(),
};

vi.mock(import('./api/IbkrAPI.js'), () => ({
  IbkrAPI: class {
    getHistory = mockMethods.getHistory;
    searchContracts = mockMethods.searchContracts;
  } as unknown as typeof IbkrAPI,
}));

const {IbkrMarketData} = await import('./IbkrMarketData.js');

const pair = new TradingPair('F', 'USD');
const ONE_DAY = 86_400_000;
const ONE_HOUR = 3_600_000;

/** Ford's sessions of 2026-11-12 through 2026-11-16, as IBKR serves them. */
const FORD_DAILY = [
  {c: 11.9, h: 12.21, l: 11.87, o: 12.18, t: 1_794_493_800_000, v: 266_490.7},
  {c: 11.91, h: 12.01, l: 11.88, o: 11.93, t: 1_794_580_200_000, v: 233_651.44},
  {c: 11.57, h: 11.92, l: 11.48, o: 11.89, t: 1_794_839_400_000, v: 331_210.53},
];

// Not concurrent: these tests share one instance and move the clock, which a parallel run would interleave.
describe('IbkrMarketData', {concurrent: false}, () => {
  let marketData: InstanceType<typeof IbkrMarketData>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMethods.searchContracts.mockResolvedValue([{conid: 9_599_491, sections: [{secType: 'STK'}], symbol: 'F'}]);
    mockMethods.getHistory.mockResolvedValue({data: FORD_DAILY, priceFactor: 100, volumeFactor: 100});
    marketData = new IbkrMarketData();
  });

  afterEach(() => {
    marketData.disconnect();
    vi.useRealTimers();
  });

  describe('toBarSize', () => {
    it('maps an interval onto IBKR’s bar strings', () => {
      expect(IbkrMarketData.toBarSize(60_000)).toBe('1min');
      expect(IbkrMarketData.toBarSize(ONE_HOUR)).toBe('1h');
      expect(IbkrMarketData.toBarSize(ONE_DAY)).toBe('1d');
    });

    it('refuses an interval IBKR has no bar for', () => {
      expect(() => IbkrMarketData.toBarSize(7 * 60_000), 'a silent nearest-match would mislabel every bar').toThrow(
        /no bar size/
      );
    });
  });

  describe('toStartTime', () => {
    it('formats an anchor the way IBKR parses it', () => {
      expect(IbkrMarketData.toStartTime(new Date('2026-11-17T11:30:00.000Z'))).toBe('20261117-11:30:00');
    });
  });

  describe('isForming', () => {
    const dailyCandle = {openTimeInMillis: Date.parse('2026-11-16T14:30:00Z')};

    it('treats a closed session as finished on the next day', () => {
      const stillForming = IbkrMarketData.isForming(dailyCandle as never, ONE_DAY, Date.parse('2026-11-17T11:30:00Z'));

      expect(
        stillForming,
        'a daily bar is stamped at the 14:30 session open, so `open + 24h` would withhold a closed session for a whole trading day'
      ).toBe(false);
    });

    it('treats the running session as unfinished', () => {
      const stillForming = IbkrMarketData.isForming(dailyCandle as never, ONE_DAY, Date.parse('2026-11-16T18:00:00Z'));

      expect(stillForming, 'a strategy must not see a partial bar').toBe(true);
    });

    it('measures an intraday bar by its own length', () => {
      const candle = {openTimeInMillis: Date.parse('2026-11-16T18:00:00Z')};

      expect(IbkrMarketData.isForming(candle as never, ONE_HOUR, Date.parse('2026-11-16T18:30:00Z'))).toBe(true);
      expect(IbkrMarketData.isForming(candle as never, ONE_HOUR, Date.parse('2026-11-16T19:00:00Z'))).toBe(false);
    });
  });

  describe('getCandles', () => {
    it('anchors one interval past the window so the last closed session survives', async () => {
      await marketData.getCandles(pair, {
        intervalInMillis: ONE_DAY,
        startTimeFirstCandle: '2026-11-09T00:00:00.000Z',
        startTimeLastCandle: '2026-11-17T11:30:00.000Z',
      });

      expect(
        mockMethods.getHistory.mock.calls[0]?.[0]?.startTime,
        'IBKR drops any bar whose open + barLength falls after the anchor, which hides yesterday’s closed session'
      ).toBe('20261118-11:30:00');
    });

    it('trims bars outside the requested window', async () => {
      const candles = await marketData.getCandles(pair, {
        intervalInMillis: ONE_DAY,
        startTimeFirstCandle: '2026-11-13T00:00:00.000Z',
        startTimeLastCandle: '2026-11-17T00:00:00.000Z',
      });

      expect(
        candles.map(candle => candle.openTimeInISO),
        'IBKR serves whole sessions, so a window lands inside a wider response'
      ).toStrictEqual(['2026-11-13T14:30:00.000Z', '2026-11-16T14:30:00.000Z']);
    });
  });

  describe('getRecentCandles', () => {
    it('returns the newest closed bars in one request', async () => {
      vi.setSystemTime(new Date('2026-11-17T11:30:00.000Z'));

      const candles = await marketData.getRecentCandles(pair, 2, ONE_DAY);

      expect(mockMethods.getHistory, 'the inherited window walk costs several round trips').toHaveBeenCalledTimes(1);
      expect(candles.map(candle => candle.close)).toStrictEqual(['11.91', '11.57']);
      expect(candles.at(-1)?.volume, 'volume reaches the caller as shares').toBe('33121053');
    });

    it('withholds the session that is still running', async () => {
      vi.setSystemTime(new Date('2026-11-16T18:00:00.000Z'));

      const candles = await marketData.getRecentCandles(pair, 3, ONE_DAY);

      expect(
        candles.map(candle => candle.openTimeInISO),
        'the bar for the open session is dropped, as it would be in a backtest'
      ).toStrictEqual(['2026-11-12T14:30:00.000Z', '2026-11-13T14:30:00.000Z']);
    });

    it('asks for nothing when no candles are wanted', async () => {
      expect(await marketData.getRecentCandles(pair, 0, ONE_DAY)).toStrictEqual([]);
      expect(mockMethods.getHistory).not.toHaveBeenCalled();
    });
  });

  describe('getLatestCandle', () => {
    it('returns the newest bar, forming or not', async () => {
      const candle = await marketData.getLatestCandle(pair, ONE_DAY);

      expect(candle.close).toBe('11.57');
      expect(candle.openTimeInISO).toBe('2026-11-16T14:30:00.000Z');
    });

    it('reports an empty history rather than returning undefined', async () => {
      mockMethods.getHistory.mockResolvedValue({data: [], priceFactor: 1, volumeFactor: 1});

      await expect(marketData.getLatestCandle(pair, ONE_DAY)).rejects.toThrow(/no 86400000 ms candles/);
    });
  });

  describe('watchCandles', () => {
    it('reaches a listener attached after subscribing', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-17T11:30:00.000Z'));
      const seen: string[] = [];

      const topicId = await marketData.watchCandles(pair, ONE_DAY, '2026-11-13T00:00:00.000Z');
      marketData.on(topicId, (candle: {openTimeInISO: string}) => seen.push(candle.openTimeInISO));
      await vi.advanceTimersByTimeAsync(1_000);

      expect(
        seen,
        'a caller can only attach once it holds the topic id, so awaiting the first poll inside watchCandles emitted these into an empty emitter'
      ).toStrictEqual(['2026-11-13T14:30:00.000Z', '2026-11-16T14:30:00.000Z']);
    });

    it('emits each closed bar once', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-17T11:30:00.000Z'));
      const seen: string[] = [];

      const topicId = await marketData.watchCandles(pair, ONE_DAY, '2026-11-13T00:00:00.000Z');
      marketData.on(topicId, (candle: {openTimeInISO: string}) => seen.push(candle.openTimeInISO));

      await vi.advanceTimersByTimeAsync(1_000);
      const afterFirstPoll = seen.length;
      await vi.advanceTimersByTimeAsync(IbkrMarketData.MAX_POLL_INTERVAL_MS * 3);

      expect(seen.length, 'a later poll returning the same bars must not emit them again').toBe(afterFirstPoll);
    });

    it('polls often enough to notice a closed daily bar', async () => {
      vi.useFakeTimers();
      const topicId = await marketData.watchCandles(pair, ONE_DAY, '2026-11-13T00:00:00.000Z');
      await vi.advanceTimersByTimeAsync(1_000);
      mockMethods.getHistory.mockClear();

      await vi.advanceTimersByTimeAsync(IbkrMarketData.MAX_POLL_INTERVAL_MS + 1_000);

      expect(
        mockMethods.getHistory.mock.calls.length,
        'polling once per interval would notice a closed daily bar up to a day late'
      ).toBeGreaterThan(0);
      marketData.unwatchCandles(topicId);
    });

    it('stops polling once unwatched', async () => {
      vi.useFakeTimers();
      const topicId = await marketData.watchCandles(pair, ONE_DAY, '2026-11-13T00:00:00.000Z');
      mockMethods.getHistory.mockClear();

      marketData.unwatchCandles(topicId);
      await vi.advanceTimersByTimeAsync(ONE_DAY * 2);

      expect(mockMethods.getHistory, 'an unwatched topic must leave no timer behind').not.toHaveBeenCalled();
    });
  });
});
