import {describe, expect, it, vi} from 'vitest';
import {TradingPair} from '../TradingPair.js';
import type {AlpacaAPI} from './api/AlpacaAPI.js';
import type * as AlpacaWebSocketModule from './AlpacaWebSocket.js';

const mockMethods = {
  // An empty response means "not a crypto symbol", so the pairs below are treated as stocks.
  getCryptoBarsLatest: vi.fn<AlpacaAPI['getCryptoBarsLatest']>().mockResolvedValue({bars: {}}),
  getStockBars: vi.fn<AlpacaAPI['getStockBars']>().mockResolvedValue({bars: {}, next_page_token: null}),
  getStockBarsLatest: vi.fn<AlpacaAPI['getStockBarsLatest']>(),
};

vi.mock(import('./api/AlpacaAPI.js'), () => ({
  AlpacaAPI: class {
    getCryptoBarsLatest = mockMethods.getCryptoBarsLatest;
    getStockBars = mockMethods.getStockBars;
    getStockBarsLatest = mockMethods.getStockBarsLatest;
  } as unknown as typeof AlpacaAPI,
}));

const mockWebSocket = {
  connect: vi.fn<(credentials: unknown, source: string) => Promise<{connectionId: string}>>().mockResolvedValue({
    connectionId: 'connection-1',
  }),
  subscribeToBars: vi.fn(),
  unsubscribeFromBars: vi.fn(),
};

vi.mock(
  import('./AlpacaWebSocket.js'),
  () => ({alpacaWebSocket: mockWebSocket}) as unknown as typeof AlpacaWebSocketModule
);

const {AlpacaMarketData} = await import('./AlpacaMarketData.js');

const credentials = {apiKey: 'key', apiSecret: 'secret', usePaperTrading: false};
const pair = new TradingPair('AAPL', 'USD');

describe('AlpacaMarketData', () => {
  describe('getCandles', () => {
    it('sends no feed so the subscription picks the best one', async () => {
      await new AlpacaMarketData(credentials).getCandles(pair, {
        intervalInMillis: 86_400_000,
        startTimeFirstCandle: '2025-12-01T00:00:00.000Z',
        startTimeLastCandle: '2025-12-02T00:00:00.000Z',
      });

      const [params] = mockMethods.getStockBars.mock.calls.at(-1) ?? [];
      expect(params, 'a forced feed would downgrade SIP history to a single exchange').not.toHaveProperty('feed');
    });
  });

  // Sequential: the tests share one mocked API, so a queued probe result must not land in the other test.
  describe.sequential('watchCandles', () => {
    const watch = async () => {
      const marketData = new AlpacaMarketData(credentials);
      await marketData.watchCandles(pair, 60_000, '2025-12-01T00:00:00.000Z');
      return mockWebSocket.connect.mock.calls.at(-1)?.[1];
    };

    it('streams SIP when the subscription allows it', async () => {
      mockMethods.getStockBarsLatest.mockResolvedValue({bars: {}});

      expect(await watch()).toBe('v2/sip');
    });

    it('falls back to the IEX stream without a SIP subscription', async () => {
      mockMethods.getStockBarsLatest.mockRejectedValue(new Error('subscription does not permit'));

      expect(await watch()).toBe('v2/iex');
    });
  });
});
