import Big from 'big.js';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {OrderPosition, OrderSide, OrderType, type Broker, type Fill} from './Broker.js';
import {MarketDataSource} from './MarketDataSource.js';
import {TradingPair} from './TradingPair.js';
import {
  AlpacaAssetClass,
  AlpacaOrderSide,
  AlpacaOrderStatus,
  AlpacaOrderType,
} from './alpaca/api/schema/OrderSchema.js';
import {TradeUpdateEvent} from './alpaca/api/schema/TradingStreamSchema.js';
import {Trading212OrderStatus} from './trading212/api/schema/OrderSchema.js';

// Shared mock references for the Alpaca stack
const alpacaMethods = {
  deleteOrder: vi.fn(),
  getAccount: vi.fn(),
  getAssets: vi.fn(),
  getClock: vi.fn(),
  getCryptoBars: vi.fn(),
  getCryptoBarsLatest: vi.fn(),
  getOrders: vi.fn(),
  getPositions: vi.fn(),
  getStockBars: vi.fn(),
  getStockBarsLatest: vi.fn(),
  postOrder: vi.fn(),
};

vi.mock('./alpaca/api/AlpacaAPI.js', () => ({
  AlpacaAPI: class {
    deleteOrder = alpacaMethods.deleteOrder;
    getAccount = alpacaMethods.getAccount;
    getAssets = alpacaMethods.getAssets;
    getClock = alpacaMethods.getClock;
    getCryptoBars = alpacaMethods.getCryptoBars;
    getCryptoBarsLatest = alpacaMethods.getCryptoBarsLatest;
    getOrders = alpacaMethods.getOrders;
    getPositions = alpacaMethods.getPositions;
    getStockBars = alpacaMethods.getStockBars;
    getStockBarsLatest = alpacaMethods.getStockBarsLatest;
    postOrder = alpacaMethods.postOrder;
  },
}));

vi.mock('./alpaca/AlpacaWebSocket.js', () => ({
  alpacaWebSocket: {
    connect: vi.fn(),
    subscribeToBars: vi.fn(),
    unsubscribeFromBars: vi.fn(),
  },
}));

const alpacaTradingStream = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  offTradeUpdate: vi.fn(),
  onTradeUpdate: vi.fn(),
};

vi.mock('./alpaca/AlpacaTradingWebSocket.js', () => ({
  alpacaTradingWebSocket: alpacaTradingStream,
}));

// Shared mock references for the Trading212 stack
const trading212Methods = {
  cancelOrder: vi.fn(),
  getAccountCash: vi.fn(),
  getAccountInfo: vi.fn(),
  getHistoryOrders: vi.fn(),
  getHistoryOrdersPage: vi.fn(),
  getInstruments: vi.fn(),
  getOrders: vi.fn(),
  getPositions: vi.fn(),
  placeLimitOrder: vi.fn(),
  placeMarketOrder: vi.fn(),
};

vi.mock('./trading212/api/Trading212API.js', () => ({
  Trading212API: class {
    cancelOrder = trading212Methods.cancelOrder;
    getAccountCash = trading212Methods.getAccountCash;
    getAccountInfo = trading212Methods.getAccountInfo;
    getHistoryOrders = trading212Methods.getHistoryOrders;
    getHistoryOrdersPage = trading212Methods.getHistoryOrdersPage;
    getInstruments = trading212Methods.getInstruments;
    getOrders = trading212Methods.getOrders;
    getPositions = trading212Methods.getPositions;
    placeLimitOrder = trading212Methods.placeLimitOrder;
    placeMarketOrder = trading212Methods.placeMarketOrder;
  },
}));

// Import after mocking
const {AlpacaBroker} = await import('./alpaca/AlpacaBroker.js');
const {Trading212Broker} = await import('./trading212/Trading212Broker.js');

class FakeMarketData extends MarketDataSource {
  disconnect = vi.fn();
  getCandles = vi.fn().mockResolvedValue([]);
  getLatestCandle = vi.fn();
  unwatchCandles = vi.fn();
  watchCandles = vi.fn().mockResolvedValue('candle-topic');
}

const TRADING212_ACCOUNT_INFO = {currencyCode: 'EUR', id: 1};

function createAlpacaBroker() {
  // An empty crypto-bars probe response marks the symbol as a stock.
  alpacaMethods.getCryptoBarsLatest.mockResolvedValue({bars: {}});
  return new AlpacaBroker({apiKey: 'test', apiSecret: 'test', marketData: new FakeMarketData(), usePaperTrading: true});
}

function createTrading212Broker() {
  return new Trading212Broker({
    apiKey: 'test',
    apiSecret: 'test',
    marketData: new FakeMarketData(),
    usePaperTrading: true,
  });
}

function createTrading212HistoryFill(options: {filledAt: string; id: number}) {
  return {
    fill: {
      filledAt: options.filledAt,
      price: 100,
      quantity: 3,
      walletImpact: {taxes: [{name: 'CURRENCY_CONVERSION_FEE', quantity: -0.25}]},
    },
    order: {id: options.id, quantity: 3, status: Trading212OrderStatus.FILLED, ticker: 'AAPL_US_EQ'},
  };
}

const alpacaTradeUpdateFillMessage = {
  event: TradeUpdateEvent.FILL,
  order: {
    asset_class: AlpacaAssetClass.US_EQUITY,
    asset_id: 'test-asset',
    canceled_at: null,
    client_order_id: 'test-client',
    created_at: '2025-01-15T14:30:00.000Z',
    expired_at: null,
    extended_hours: false,
    failed_at: null,
    filled_at: '2025-01-15T14:30:01.123Z',
    filled_avg_price: '150.25',
    filled_qty: '10',
    id: 'alpaca-watched-fill',
    legs: null,
    limit_price: null,
    notional: null,
    qty: '10',
    replaced_at: null,
    replaced_by: null,
    replaces: null,
    side: AlpacaOrderSide.BUY,
    status: AlpacaOrderStatus.FILLED,
    stop_price: null,
    submitted_at: '2025-01-15T14:30:00.001Z',
    symbol: 'SHOP',
    time_in_force: 'day',
    type: AlpacaOrderType.MARKET,
    updated_at: '2025-01-15T14:30:01.123Z',
  },
  price: '150.25',
  qty: '10',
  timestamp: '2025-01-15T14:30:01.123Z',
};

/**
 * One venue-agnostic driver per broker. Each `prime*` method arranges the mocked API so the
 * neutral `Broker` call under test can succeed, and returns the ids the contract asserts on.
 */
interface BrokerContractHarness {
  createBroker: () => Broker;
  emitFill: () => Promise<void>;
  /**
   * Documented divergence: Alpaca debits fees in the instrument's counter currency, while
   * Trading212 debits all fees in the account currency (EUR account here).
   */
  expectedFeeAsset: string;
  name: string;
  pair: TradingPair;
  primeCancelableOrders: () => string[];
  primeFees: () => void;
  primeFills: () => {newestOrderId: string; oldestOrderId: string};
  primeLimitOrder: () => string;
  primeMarketOrder: () => string;
  primeWatchOrders: () => void;
}

const alpacaHarness: BrokerContractHarness = {
  createBroker: createAlpacaBroker,
  emitFill: async () => {
    const registeredCallback = alpacaTradingStream.onTradeUpdate.mock.calls[0]?.[1];
    registeredCallback(alpacaTradeUpdateFillMessage);
  },
  expectedFeeAsset: 'USD',
  name: AlpacaBroker.NAME,
  pair: new TradingPair('SHOP', 'USD'),
  primeCancelableOrders: () => {
    alpacaMethods.getOrders.mockResolvedValue([{id: 'alpaca-open-1'}, {id: 'alpaca-open-2'}]);
    alpacaMethods.deleteOrder.mockResolvedValue(undefined);
    return ['alpaca-open-1', 'alpaca-open-2'];
  },
  primeFees: () => undefined,
  primeFills: () => {
    const filledOrder = {
      asset_class: AlpacaAssetClass.US_EQUITY,
      filled_avg_price: '53.05',
      filled_qty: '3',
      side: AlpacaOrderSide.BUY,
      status: AlpacaOrderStatus.FILLED,
    };
    alpacaMethods.getOrders.mockResolvedValue([
      {...filledOrder, created_at: '2025-02-01T10:00:00.000Z', id: 'alpaca-fill-newest'},
      {...filledOrder, created_at: '2025-01-01T10:00:00.000Z', id: 'alpaca-fill-oldest'},
    ]);
    return {newestOrderId: 'alpaca-fill-newest', oldestOrderId: 'alpaca-fill-oldest'};
  },
  primeLimitOrder: () => {
    alpacaMethods.postOrder.mockResolvedValue({
      id: 'alpaca-limit-1',
      limit_price: '100',
      notional: null,
      qty: '5',
      side: AlpacaOrderSide.SELL,
      type: AlpacaOrderType.LIMIT,
    });
    return 'alpaca-limit-1';
  },
  primeMarketOrder: () => {
    alpacaMethods.postOrder.mockResolvedValue({
      id: 'alpaca-market-1',
      limit_price: null,
      notional: null,
      qty: '5',
      side: AlpacaOrderSide.BUY,
      type: AlpacaOrderType.MARKET,
    });
    return 'alpaca-market-1';
  },
  primeWatchOrders: () => {
    alpacaTradingStream.connect.mockResolvedValue({connectionId: 'trading-conn', stream: {}});
  },
};

const trading212Harness: BrokerContractHarness = {
  createBroker: createTrading212Broker,
  emitFill: async () => {
    trading212Methods.getHistoryOrdersPage.mockResolvedValue({
      items: [createTrading212HistoryFill({filledAt: '2025-02-01T10:00:00.000Z', id: 500})],
      nextPagePath: null,
    });
    await vi.advanceTimersByTimeAsync(Trading212Broker.ORDER_POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(0);
  },
  expectedFeeAsset: 'EUR',
  name: Trading212Broker.NAME,
  pair: new TradingPair('AAPL_US_EQ', 'USD'),
  primeCancelableOrders: () => {
    const openOrder = {
      limitPrice: 90,
      quantity: 1,
      status: Trading212OrderStatus.NEW,
      strategy: 'QUANTITY',
      ticker: 'AAPL_US_EQ',
      type: 'LIMIT',
    };
    trading212Methods.getOrders.mockResolvedValue([
      {...openOrder, id: 201},
      {...openOrder, id: 202},
    ]);
    trading212Methods.cancelOrder.mockResolvedValue(undefined);
    return ['201', '202'];
  },
  primeFees: () => {
    trading212Methods.getAccountInfo.mockResolvedValue(TRADING212_ACCOUNT_INFO);
  },
  primeFills: () => {
    trading212Methods.getAccountInfo.mockResolvedValue(TRADING212_ACCOUNT_INFO);
    trading212Methods.getHistoryOrders.mockResolvedValue([
      createTrading212HistoryFill({filledAt: '2025-02-01T10:00:00.000Z', id: 302}),
      createTrading212HistoryFill({filledAt: '2025-01-01T10:00:00.000Z', id: 301}),
    ]);
    return {newestOrderId: '302', oldestOrderId: '301'};
  },
  primeLimitOrder: () => {
    trading212Methods.placeLimitOrder.mockResolvedValue({
      id: 101,
      limitPrice: 100,
      quantity: -5,
      status: Trading212OrderStatus.NEW,
      strategy: 'QUANTITY',
      ticker: 'AAPL_US_EQ',
      type: 'LIMIT',
    });
    return '101';
  },
  primeMarketOrder: () => {
    trading212Methods.placeMarketOrder.mockResolvedValue({
      id: 102,
      quantity: 5,
      status: Trading212OrderStatus.NEW,
      strategy: 'QUANTITY',
      ticker: 'AAPL_US_EQ',
      type: 'MARKET',
    });
    return '102';
  },
  primeWatchOrders: () => {
    // The polling watcher only fires under fake timers; enable them before `watchOrders()` is called.
    vi.useFakeTimers();
    trading212Methods.getAccountInfo.mockResolvedValue(TRADING212_ACCOUNT_INFO);
    trading212Methods.getInstruments.mockResolvedValue([
      {addedOn: '2020-01-01T00:00:00.000Z', currencyCode: 'USD', name: 'Apple', ticker: 'AAPL_US_EQ', type: 'STOCK'},
    ]);
    trading212Methods.getHistoryOrdersPage.mockResolvedValue({items: [], nextPagePath: null});
  },
};

const harnesses: BrokerContractHarness[] = [alpacaHarness, trading212Harness];

describe('Broker contract', {concurrent: false}, () => {
  describe.each(harnesses)('$name', harness => {
    let broker: Broker;

    beforeEach(() => {
      vi.clearAllMocks();
      broker = harness.createBroker();
    });

    afterEach(() => {
      broker.disconnect();
      vi.useRealTimers();
    });

    it('placeLimitOrder returns a neutral PendingLimitOrder', async () => {
      const expectedId = harness.primeLimitOrder();

      const order = await broker.placeLimitOrder(harness.pair, {price: '100', side: OrderSide.SELL, size: '5'});

      expect(order).toEqual({
        id: expectedId,
        pair: harness.pair,
        price: '100',
        side: OrderSide.SELL,
        size: '5',
        type: OrderType.LIMIT,
      });
    });

    it('placeMarketOrder returns a neutral PendingMarketOrder for quantity-sized orders', async () => {
      const expectedId = harness.primeMarketOrder();

      const order = await broker.placeMarketOrder(harness.pair, {
        side: OrderSide.BUY,
        size: '5',
        sizeInCounter: false,
      });

      expect(order).toEqual({
        id: expectedId,
        pair: harness.pair,
        side: OrderSide.BUY,
        size: '5',
        type: OrderType.MARKET,
      });
    });

    it('cancelOpenOrders resolves to the ids of the canceled orders', async () => {
      const expectedIds = harness.primeCancelableOrders();

      await expect(broker.cancelOpenOrders(harness.pair)).resolves.toEqual(expectedIds);
    });

    it('getFills returns fills newest-first with a neutral shape', async () => {
      const {newestOrderId, oldestOrderId} = harness.primeFills();

      const fills = await broker.getFills(harness.pair);

      expect(fills.map(fill => fill.order_id)).toEqual([newestOrderId, oldestOrderId]);
      expect(fills[0]).toMatchObject({
        created_at: expect.any(String),
        fee: expect.any(String),
        feeAsset: expect.any(String),
        pair: harness.pair,
        position: OrderPosition.LONG,
        price: expect.any(String),
        side: OrderSide.BUY,
        size: expect.any(String),
      });
      expect(new Date(fills[0]?.created_at ?? '').getTime()).toBeGreaterThan(
        new Date(fills[1]?.created_at ?? '').getTime()
      );
    });

    it('estimateFee derives its commission from getFeeRate and reports the fee asset', async () => {
      harness.primeFees();
      const notional = new Big(1_000);

      const rate = await broker.getFeeRate(harness.pair, OrderType.MARKET);
      const estimate = await broker.estimateFee(harness.pair, OrderType.MARKET, notional);

      expect(estimate.commission.eq(notional.times(rate))).toBe(true);
      expect(estimate.total.gte(estimate.commission)).toBe(true);
      expect(estimate.feeAsset).toBe(harness.expectedFeeAsset);
    });

    it('watchOrders returns a topicId and emits a Fill on that topic', async () => {
      harness.primeWatchOrders();

      const topicId = await broker.watchOrders();
      expect(typeof topicId).toBe('string');
      expect(topicId.length).toBeGreaterThan(0);

      const fillHandler = vi.fn<(fill: Fill) => void>();
      broker.on(topicId, fillHandler);
      await harness.emitFill();

      expect(fillHandler).toHaveBeenCalledTimes(1);
      expect(fillHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: expect.any(String),
          price: expect.any(String),
          side: OrderSide.BUY,
          size: expect.any(String),
        })
      );
      broker.unwatchOrders(topicId);
    });
  });

  /*
   * Where a venue legitimately deviates from the shared semantics, the divergence is asserted
   * here — explicitly, per venue — so this file stays the single place where cross-broker
   * differences are visible.
   */
  describe('documented divergences', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('notional (sizeInCounter) MARKET orders', () => {
      it('AlpacaBroker submits them as notional orders', async () => {
        alpacaMethods.postOrder.mockResolvedValue({
          id: 'alpaca-notional-1',
          notional: '200',
          qty: null,
          side: AlpacaOrderSide.BUY,
          type: AlpacaOrderType.MARKET,
        });
        const broker = createAlpacaBroker();

        const order = await broker.placeMarketOrder(new TradingPair('SHOP', 'USD'), {
          side: OrderSide.BUY,
          size: '200',
          sizeInCounter: true,
        });

        expect(order.size).toBe('200');
        expect(alpacaMethods.postOrder).toHaveBeenCalledWith(expect.objectContaining({notional: '200'}));
      });

      it('Trading212Broker rejects them because its public API only supports quantity orders', async () => {
        const broker = createTrading212Broker();

        await expect(
          broker.placeMarketOrder(new TradingPair('AAPL_US_EQ', 'USD'), {
            side: OrderSide.BUY,
            size: '200',
            sizeInCounter: true,
          })
        ).rejects.toThrow('Notional (sizeInCounter) orders are not supported by the Trading212 public API.');
        expect(trading212Methods.placeMarketOrder).not.toHaveBeenCalled();
      });
    });

    describe('fee model', () => {
      it('AlpacaBroker charges flat commission rates and never a currency-conversion fee', async () => {
        const broker = createAlpacaBroker();

        const rates = await broker.getFeeRates(new TradingPair('SHOP', 'USD'));

        expect(rates[OrderType.LIMIT]).toEqual(new Big(0.0015));
        expect(rates[OrderType.MARKET]).toEqual(new Big(0.0025));
        expect(rates.CURRENCY_CONVERSION_FEE).toBeUndefined();
      });

      it('Trading212Broker charges 0% commission plus a conversion fee on cross-currency instruments only', async () => {
        trading212Methods.getAccountInfo.mockResolvedValue(TRADING212_ACCOUNT_INFO);
        const broker = createTrading212Broker();

        const crossCurrencyRates = await broker.getFeeRates(new TradingPair('AAPL_US_EQ', 'USD'));
        expect(crossCurrencyRates[OrderType.LIMIT]).toEqual(new Big(0));
        expect(crossCurrencyRates[OrderType.MARKET]).toEqual(new Big(0));
        expect(crossCurrencyRates.CURRENCY_CONVERSION_FEE).toEqual(new Big(0.0015));

        const sameCurrencyRates = await broker.getFeeRates(new TradingPair('SAP_XETRA_EQ', 'EUR'));
        expect(sameCurrencyRates.CURRENCY_CONVERSION_FEE).toBeUndefined();
      });
    });
  });
});
