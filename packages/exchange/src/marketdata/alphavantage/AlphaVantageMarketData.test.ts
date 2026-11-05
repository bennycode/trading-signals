import {ms} from 'ms';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {TradingPair} from '../../broker/TradingPair.js';
import {AlphaVantageMessageError, type AlphaVantageAPI} from './api/AlphaVantageAPI.js';

const mockMethods = {
  getTimeSeries: vi.fn<AlphaVantageAPI['getTimeSeries']>(),
};

/*
 * The real module has to load alongside the stub: `AlphaVantageMarketData.toFunction` returns the
 * `AlphaVantageFunction` values from it, so replacing the whole module would leave them undefined.
 */
vi.mock(import('./api/AlphaVantageAPI.js'), async importActual => {
  const actual = await importActual();
  return {
    ...actual,
    AlphaVantageAPI: class {
      getTimeSeries = mockMethods.getTimeSeries;
    } as unknown as typeof AlphaVantageAPI,
  };
});

// Import after mocking
const {AlphaVantageMarketData} = await import('./AlphaVantageMarketData.js');

/*
 * Newest first, the order Alpha Vantage answers in, which is what the ordering test below proves
 * gets reversed. Sorting these keys would make that test pass even without the mapper's sort.
 */
/* eslint-disable sort-keys */
const DAILY_SERIES = {
  '2026-10-27': {
    '1. open': '131.00',
    '2. high': '132.10',
    '3. low': '130.80',
    '4. close': '131.605',
    '5. volume': '900',
  },
  '2026-10-26': {
    '1. open': '130.20',
    '2. high': '131.40',
    '3. low': '129.90',
    '4. close': '131.00',
    '5. volume': '800',
  },
  '2026-10-23': {
    '1. open': '129.50',
    '2. high': '130.60',
    '3. low': '129.10',
    '4. close': '130.20',
    '5. volume': '700',
  },
} as const;
/* eslint-enable sort-keys */

const PAIR = new TradingPair('EUNL.DEX', 'EUR');

function createMarketData() {
  return new AlphaVantageMarketData({apiKey: 'test-key'});
}

// Sequential: every test drives the one shared `getTimeSeries` stub, which concurrent runs would interleave.
describe('AlphaVantageMarketData', {concurrent: false}, () => {
  beforeEach(() => {
    mockMethods.getTimeSeries.mockReset();
    mockMethods.getTimeSeries.mockResolvedValue({...DAILY_SERIES});
  });

  describe('getCandles', () => {
    it('returns the series oldest first with the pair and interval attached', async () => {
      const candles = await createMarketData().getCandles(PAIR, {
        intervalInMillis: ms('1d'),
        startTimeFirstCandle: '2026-10-23T00:00:00.000Z',
        startTimeLastCandle: '2026-10-27T00:00:00.000Z',
      });

      expect(
        candles.map(candle => candle.openTimeInISO),
        'Alpha Vantage answers newest first'
      ).toEqual(['2026-10-23T00:00:00.000Z', '2026-10-26T00:00:00.000Z', '2026-10-27T00:00:00.000Z']);
      expect(candles[0]).toEqual({
        base: 'EUNL.DEX',
        close: '130.20',
        counter: 'EUR',
        high: '130.60',
        low: '129.10',
        open: '129.50',
        openTimeInISO: '2026-10-23T00:00:00.000Z',
        openTimeInMillis: 1792713600000,
        sizeInMillis: ms('1d'),
        volume: '700',
      });
    });

    it('drops candles outside the requested window', async () => {
      const candles = await createMarketData().getCandles(PAIR, {
        intervalInMillis: ms('1d'),
        startTimeFirstCandle: '2026-10-26T00:00:00.000Z',
        startTimeLastCandle: '2026-10-26T00:00:00.000Z',
      });

      expect(
        candles.map(candle => candle.close),
        'only the single day asked for survives'
      ).toEqual(['131.00']);
    });

    it('fetches each series once, because the free plan allows 25 requests a day', async () => {
      const marketData = createMarketData();
      const request = {
        intervalInMillis: ms('1d'),
        startTimeFirstCandle: '2026-10-23T00:00:00.000Z',
        startTimeLastCandle: '2026-10-27T00:00:00.000Z',
      };

      await marketData.getCandles(PAIR, request);
      await marketData.getCandles(PAIR, request);

      expect(mockMethods.getTimeSeries).toHaveBeenCalledTimes(1);
    });

    it('does not cache a failed fetch, so a rate limit is recoverable', async () => {
      const marketData = createMarketData();
      const request = {
        intervalInMillis: ms('1d'),
        startTimeFirstCandle: '2026-10-23T00:00:00.000Z',
        startTimeLastCandle: '2026-10-27T00:00:00.000Z',
      };
      mockMethods.getTimeSeries.mockRejectedValueOnce(new Error('rate limit'));

      await expect(marketData.getCandles(PAIR, request)).rejects.toThrow('rate limit');
      const candles = await marketData.getCandles(PAIR, request);

      expect(candles.length, 'the retry reaches the API instead of a cached rejection').toBe(3);
      expect(mockMethods.getTimeSeries).toHaveBeenCalledTimes(2);
    });

    it('asks for the weekly series when the interval is a week', async () => {
      await createMarketData().getCandles(PAIR, {
        intervalInMillis: ms('7d'),
        startTimeFirstCandle: '2026-10-23T00:00:00.000Z',
        startTimeLastCandle: '2026-10-27T00:00:00.000Z',
      });

      expect(mockMethods.getTimeSeries).toHaveBeenCalledWith(expect.objectContaining({function: 'TIME_SERIES_WEEKLY'}));
    });
  });

  describe('getLatestCandle', () => {
    it('returns the newest candle of the series', async () => {
      const candle = await createMarketData().getLatestCandle(PAIR, ms('1d'));

      expect(candle.openTimeInISO).toBe('2026-10-27T00:00:00.000Z');
      expect(candle.close).toBe('131.605');
    });

    it('throws when the symbol has no candles at all', async () => {
      mockMethods.getTimeSeries.mockResolvedValue({});

      await expect(createMarketData().getLatestCandle(PAIR, ms('1d'))).rejects.toThrow(
        'Alpha Vantage returned no candles'
      );
    });
  });

  describe('toFunction', () => {
    it('maps the daily interval', () => {
      expect(AlphaVantageMarketData.toFunction(ms('1d'))).toBe('TIME_SERIES_DAILY');
    });

    it('maps the weekly interval', () => {
      expect(AlphaVantageMarketData.toFunction(ms('7d'))).toBe('TIME_SERIES_WEEKLY');
    });

    it('refuses an interval it has no series for', () => {
      expect(() => AlphaVantageMarketData.toFunction(ms('1m'))).toThrow(
        /Alpha Vantage serves daily .* and weekly .* candles here/
      );
    });
  });

  describe('watchCandles', () => {
    it('rejects because Alpha Vantage publishes no candle stream', async () => {
      await expect(createMarketData().watchCandles()).rejects.toThrow('has no candle stream');
    });
  });

  describe('disconnect', () => {
    it('clears the cache so a later call fetches again', async () => {
      const marketData = createMarketData();
      const request = {
        intervalInMillis: ms('1d'),
        startTimeFirstCandle: '2026-10-23T00:00:00.000Z',
        startTimeLastCandle: '2026-10-27T00:00:00.000Z',
      };

      await marketData.getCandles(PAIR, request);
      marketData.disconnect();
      await marketData.getCandles(PAIR, request);

      expect(mockMethods.getTimeSeries).toHaveBeenCalledTimes(2);
    });
  });
});

describe('AlphaVantageMessageError', {concurrent: false}, () => {
  it('treats a burst-limit notice as worth retrying', () => {
    const error = new AlphaVantageMessageError(
      'Thank you for using Alpha Vantage! Please consider spreading out your free API requests more sparingly (1 request per second).'
    );

    expect(error.isThrottled, 'a throttle arrives as HTTP 200, so only the wording marks it retryable').toBe(true);
  });

  it('treats a premium-only rejection as permanent', () => {
    const error = new AlphaVantageMessageError(
      'The outputsize=full parameter value is a premium feature for the TIME_SERIES_DAILY endpoint.'
    );

    expect(error.isThrottled, 'retrying a refused parameter would never succeed').toBe(false);
  });
});
