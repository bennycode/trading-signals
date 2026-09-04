import Big from 'big.js';
import {describe, expect, it, vi, beforeEach} from 'vitest';
import {z} from 'zod';
import {TradingPair} from '../TradingPair.js';
import {OrderPosition, OrderSide, OrderType} from '../Broker.js';
import {AlpacaAssetClass, AlpacaOrderSide, AlpacaOrderStatus, AlpacaOrderType} from './api/schema/OrderSchema.js';
import {PositionSide} from './api/schema/PositionSchema.js';
import {TradeUpdateEvent} from './api/schema/TradingStreamSchema.js';
import type {AlpacaAPI} from './api/AlpacaAPI.js';
import type {Account} from './api/schema/AccountSchema.js';
import type {Asset} from './api/schema/AssetSchema.js';
import type {Bar} from './api/schema/BarSchema.js';
import type {Order} from './api/schema/OrderSchema.js';
import type {Position} from './api/schema/PositionSchema.js';
import type {alpacaTradingWebSocket} from './AlpacaTradingWebSocket.js';

// Shared mock references
const mockMethods = {
  deleteOrder: vi.fn<AlpacaAPI['deleteOrder']>(),
  getAccount: vi.fn<AlpacaAPI['getAccount']>(),
  getAssets: vi.fn<AlpacaAPI['getAssets']>(),
  getClock: vi.fn<AlpacaAPI['getClock']>(),
  getCryptoBars: vi.fn<AlpacaAPI['getCryptoBars']>(),
  getCryptoBarsLatest: vi.fn<AlpacaAPI['getCryptoBarsLatest']>().mockResolvedValue({bars: {}}),
  getOrders: vi.fn<AlpacaAPI['getOrders']>(),
  getPositions: vi.fn<AlpacaAPI['getPositions']>(),
  getStockBars: vi.fn<AlpacaAPI['getStockBars']>(),
  getStockBarsLatest: vi.fn<AlpacaAPI['getStockBarsLatest']>(),
  postOrder: vi.fn<AlpacaAPI['postOrder']>(),
};

vi.mock(import('./api/AlpacaAPI.js'), () => ({
  AlpacaAPI: class {
    deleteOrder = mockMethods.deleteOrder;
    getAccount = mockMethods.getAccount;
    getAssets = mockMethods.getAssets;
    getClock = mockMethods.getClock;
    getCryptoBars = mockMethods.getCryptoBars;
    getCryptoBarsLatest = mockMethods.getCryptoBarsLatest;
    getOrders = mockMethods.getOrders;
    getPositions = mockMethods.getPositions;
    getStockBars = mockMethods.getStockBars;
    getStockBarsLatest = mockMethods.getStockBarsLatest;
    postOrder = mockMethods.postOrder;
  } as unknown as typeof AlpacaAPI,
}));

vi.mock(import('./AlpacaWebSocket.js'));

const mockTradingWebSocket = {
  connect: vi.fn().mockResolvedValue({connectionId: 'trading-conn', stream: {}}),
  disconnect: vi.fn(),
  offTradeUpdate: vi.fn(),
  onTradeUpdate: vi.fn<typeof alpacaTradingWebSocket.onTradeUpdate>(),
};

vi.mock(import('./AlpacaTradingWebSocket.js'), () => ({
  alpacaTradingWebSocket: mockTradingWebSocket as unknown as typeof alpacaTradingWebSocket,
}));

// Import after mocking
const {AlpacaBroker} = await import('./AlpacaBroker.js');
const {AlpacaMarketData} = await import('./AlpacaMarketData.js');
const {SimplifiedHttpError} = await import('../../util/SimplifiedHttpError.js');

// The mocks carry real AlpacaAPI signatures, so fixtures must satisfy the whole schema.
function anOrder(overrides: Partial<Order> = {}): Order {
  return {
    asset_class: AlpacaAssetClass.US_EQUITY,
    asset_id: 'asset-1',
    canceled_at: null,
    client_order_id: 'client-1',
    created_at: '2023-08-21T15:57:26.195019Z',
    expired_at: null,
    extended_hours: false,
    failed_at: null,
    filled_at: '2023-08-21T15:57:27.000000Z',
    filled_avg_price: '53.05',
    filled_qty: '3',
    id: 'order-1',
    legs: null,
    limit_price: null,
    notional: null,
    qty: '3',
    replaced_at: null,
    replaced_by: null,
    replaces: null,
    side: AlpacaOrderSide.BUY,
    status: AlpacaOrderStatus.FILLED,
    stop_price: null,
    submitted_at: '2023-08-21T15:57:26.000000Z',
    symbol: 'SHOP',
    time_in_force: 'day',
    type: AlpacaOrderType.MARKET,
    updated_at: '2023-08-21T15:57:27.000000Z',
    ...overrides,
  };
}

function aPosition(overrides: Partial<Position> = {}): Position {
  return {
    asset_class: AlpacaAssetClass.US_EQUITY,
    asset_id: 'asset-1',
    avg_entry_price: '50',
    change_today: '0',
    cost_basis: '150',
    current_price: '53',
    lastday_price: '52',
    market_value: '159',
    qty: '3',
    qty_available: '3',
    side: PositionSide.LONG,
    symbol: 'SHOP',
    unrealized_intraday_pl: '0',
    unrealized_intraday_plpc: '0',
    unrealized_pl: '9',
    unrealized_plpc: '0.06',
    ...overrides,
  };
}

function anAccount(overrides: Partial<Account> = {}): Account {
  return {
    account_blocked: false,
    account_number: '123456789',
    buying_power: '1000',
    cash: '1000',
    created_at: '2023-01-01T00:00:00Z',
    currency: 'USD',
    daytrade_count: 0,
    equity: '1000',
    id: 'account-1',
    initial_margin: '0',
    last_equity: '30000',
    long_market_value: '0',
    maintenance_margin: '0',
    multiplier: '1',
    pattern_day_trader: false,
    portfolio_value: '1000',
    short_market_value: '0',
    shorting_enabled: false,
    status: 'ACTIVE',
    trade_suspended_by_user: false,
    trading_blocked: false,
    transfers_blocked: false,
    ...overrides,
  };
}

function anAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    class: 'us_equity',
    easy_to_borrow: false,
    exchange: 'NASDAQ',
    fractionable: true,
    id: 'asset-1',
    marginable: false,
    name: 'Test Asset',
    shortable: false,
    status: 'active',
    symbol: 'SHOP',
    tradable: true,
    ...overrides,
  };
}

function aBar(close: number): Bar {
  return {c: close, h: close, l: close, n: 1, o: close, t: '2024-01-01T00:00:00Z', v: 1, vw: close};
}

describe('AlpacaBroker', {concurrent: false}, () => {
  let exchange: InstanceType<typeof AlpacaBroker>;

  beforeEach(() => {
    vi.clearAllMocks();
    const marketData = new AlpacaMarketData({apiKey: 'test', apiSecret: 'test', usePaperTrading: true});
    exchange = new AlpacaBroker({apiKey: 'test', apiSecret: 'test', marketData, usePaperTrading: true});
    // Default: stock symbol (empty crypto bars)
    mockMethods.getCryptoBarsLatest.mockResolvedValue({bars: {}});
  });

  describe('getFeeRates', () => {
    it('returns hardcoded Alpaca fee rates', async () => {
      const pair = new TradingPair('SHOP', 'USD');
      const fees = await exchange.getFeeRates(pair);

      expect(fees[OrderType.MARKET]).toEqual(new Big(0.0025));
      expect(fees[OrderType.LIMIT]).toEqual(new Big(0.0015));
    });
  });

  describe('listBalances', () => {
    it('returns positions and account cash', async () => {
      mockMethods.getPositions.mockResolvedValue([
        aPosition({asset_class: 'us_equity', qty: '3', side: PositionSide.LONG, symbol: 'SHOP'}),
      ]);
      mockMethods.getAccount.mockResolvedValue(anAccount({cash: '500.50', currency: 'USD', last_equity: '30000'}));

      const balances = await exchange.listBalances();

      expect(balances).toHaveLength(2);
      expect(balances[0]).toEqual({available: '3', currency: 'SHOP', hold: '0', position: OrderPosition.LONG});
      expect(balances[1]).toEqual({
        available: '500.5',
        currency: 'USD',
        hold: '0',
        position: OrderPosition.LONG,
      });
    });

    it('trims crypto USD suffix from symbol', async () => {
      mockMethods.getPositions.mockResolvedValue([
        aPosition({asset_class: 'crypto', qty: '100', side: PositionSide.LONG, symbol: 'USDTUSD'}),
      ]);
      mockMethods.getAccount.mockResolvedValue(anAccount({cash: '0', currency: 'USD', last_equity: '30000'}));

      const balances = await exchange.listBalances();
      expect(balances[0]?.currency).toBe('USDT');
    });

    it('uses absolute values for SHORT positions', async () => {
      mockMethods.getPositions.mockResolvedValue([
        aPosition({asset_class: 'us_equity', qty: '-3', side: PositionSide.SHORT, symbol: 'TSLA'}),
      ]);
      mockMethods.getAccount.mockResolvedValue(anAccount({cash: '0', currency: 'USD', last_equity: '30000'}));

      const balances = await exchange.listBalances();
      expect(balances[0]).toEqual({
        available: '3',
        currency: 'TSLA',
        hold: '0',
        position: OrderPosition.SHORT,
      });
    });

    it('throws an error when Alpaca returns an unknown position side', async () => {
      mockMethods.getPositions.mockResolvedValue([
        aPosition({
          asset_class: 'us_equity',
          qty: '3',
          // Deliberately invalid: this test exists to prove the broker rejects a side it cannot map.
          side: 'unknown' as PositionSide,
          symbol: 'SHOP',
        }),
      ]);
      mockMethods.getAccount.mockResolvedValue(anAccount({cash: '0', currency: 'USD', last_equity: '30000'}));

      await expect(exchange.listBalances()).rejects.toThrow();
    });
  });

  describe('getFills', () => {
    it('returns only filled orders mapped to Fill', async () => {
      const filledOrder = anOrder({
        asset_class: AlpacaAssetClass.US_EQUITY,
        created_at: '2023-08-21T15:57:26.195019Z',
        filled_avg_price: '53.05',
        filled_qty: '3',
        id: 'order-1',
        side: AlpacaOrderSide.BUY,
        status: AlpacaOrderStatus.FILLED,
      });

      const canceledOrder = anOrder({
        ...filledOrder,
        filled_avg_price: null,
        filled_qty: '0',
        id: 'order-2',
        status: AlpacaOrderStatus.CANCELED,
      });

      mockMethods.getOrders.mockResolvedValue([filledOrder, canceledOrder]);

      const pair = new TradingPair('SHOP', 'USD');
      const fills = await exchange.getFills(pair);

      expect(fills).toHaveLength(1);
      expect(fills[0]?.order_id).toBe('order-1');
      expect(fills[0]?.price).toBe('53.05');
      expect(fills[0]?.side).toBe(OrderSide.BUY);
      expect(fills[0]?.fee, 'stock trades are commission-free on Alpaca').toBe('0');
      expect(fills[0]?.feeAsset).toBe('USD');
    });

    it('derives the crypto commission the order payload does not carry', async () => {
      mockMethods.getCryptoBarsLatest.mockResolvedValue({bars: {'USDT/USD': aBar(1)}});
      mockMethods.getOrders.mockResolvedValue([
        anOrder({
          asset_class: AlpacaAssetClass.CRYPTO,
          created_at: '2023-09-23T10:21:09.000000Z',
          filled_avg_price: '0.99912',
          filled_qty: '56.7732',
          id: 'crypto-sell',
          side: AlpacaOrderSide.SELL,
          status: AlpacaOrderStatus.FILLED,
          type: AlpacaOrderType.MARKET,
        }),
      ]);

      const fills = await exchange.getFills(new TradingPair('USDT', 'USD'));

      expect(fills[0]?.fee, 'matches the CFEE activity Alpaca charged for this exact fill').toBe('0.15');
      expect(fills[0]?.feeAsset, 'a SELL is credited in the counter asset').toBe('USD');
    });

    it('bills a crypto BUY in the base asset', async () => {
      mockMethods.getCryptoBarsLatest.mockResolvedValue({bars: {'BTC/USD': aBar(1)}});
      mockMethods.getOrders.mockResolvedValue([
        anOrder({
          asset_class: AlpacaAssetClass.CRYPTO,
          created_at: '2024-05-06T09:00:00.000001Z',
          filled_avg_price: '61234.5',
          filled_qty: '2.5',
          id: 'crypto-buy',
          side: AlpacaOrderSide.BUY,
          status: AlpacaOrderStatus.FILLED,
          type: AlpacaOrderType.MARKET,
        }),
      ]);

      const fills = await exchange.getFills(new TradingPair('BTC', 'USD'));

      expect(fills[0]?.fee, '2.5 BTC * 0.0025 taker rate').toBe('0.00625');
      expect(fills[0]?.feeAsset, 'a BUY is credited in the base asset').toBe('BTC');
    });

    it('rejects a filled order that has no average fill price', async () => {
      mockMethods.getCryptoBarsLatest.mockResolvedValue({bars: {'BTC/USD': aBar(1)}});
      mockMethods.getOrders.mockResolvedValue([
        anOrder({
          asset_class: AlpacaAssetClass.CRYPTO,
          created_at: '2024-05-06T09:00:00.000001Z',
          filled_avg_price: null,
          filled_qty: '2.5',
          id: 'crypto-no-price',
          side: AlpacaOrderSide.BUY,
          status: AlpacaOrderStatus.FILLED,
          type: AlpacaOrderType.MARKET,
        }),
      ]);

      await expect(
        exchange.getFills(new TradingPair('BTC', 'USD')),
        'a Fill priced "null" would throw later inside new Big(fill.price)'
      ).rejects.toThrowError(/no average fill price/);
    });
  });

  describe('getFillByOrderId', () => {
    it('returns undefined when no matching fill is found', async () => {
      mockMethods.getOrders.mockResolvedValue([]);

      const pair = new TradingPair('SHOP', 'USD');
      const fill = await exchange.getFillByOrderId(pair, 'nonexistent');
      expect(fill).toBeUndefined();
    });
  });

  describe('getTradingRules', () => {
    it('returns crypto trading rules with exchange-provided values', async () => {
      mockMethods.getCryptoBarsLatest.mockResolvedValue({
        bars: {'BTC/USD': aBar(1)},
      });
      mockMethods.getAssets.mockResolvedValue([
        anAsset({
          class: 'crypto',
          min_order_size: '0.0001',
          min_trade_increment: '0.0001',
          price_increment: '0.01',
          symbol: 'BTC/USD',
        }),
      ]);

      const pair = new TradingPair('BTC', 'USD');
      const rules = await exchange.getTradingRules(pair);

      expect(rules.base_min_size).toBe('0.0001');
      expect(rules.base_increment).toBe('0.0001');
      expect(rules.counter_increment).toBe('0.01');
      expect(rules.counter_min_size).toBe('1');
    });

    it('returns stock trading rules with hardcoded defaults', async () => {
      mockMethods.getAssets.mockResolvedValue([anAsset({class: 'us_equity', symbol: 'SHOP'})]);

      const pair = new TradingPair('SHOP', 'USD');
      const rules = await exchange.getTradingRules(pair);

      expect(rules.base_min_size).toBe('0.000000001');
      expect(rules.base_increment).toBe('0.000000001');
      expect(rules.counter_increment).toBe('0.01');
    });

    it('throws when asset is not found', async () => {
      mockMethods.getAssets.mockResolvedValue([]);

      const pair = new TradingPair('UNKNOWN', 'USD');
      await expect(exchange.getTradingRules(pair)).rejects.toThrowError(
        'Could not find trading rules for symbol "UNKNOWN" of asset class "us_equity".'
      );
    });
  });

  describe('placeOrder', () => {
    const isUuid = (value: string) => z.uuid({version: 'v4'}).safeParse(value).success;
    const uuidMatcher: unknown = expect.toSatisfy(isUuid);

    it('places a stock MARKET BUY order with notional amount', async () => {
      mockMethods.postOrder.mockResolvedValue(
        anOrder({
          id: 'order-123',
          notional: '200',
          qty: null,
          side: AlpacaOrderSide.BUY,
          type: AlpacaOrderType.MARKET,
        })
      );

      const pair = new TradingPair('SHOP', 'USD');
      const order = await exchange.placeMarketOrder(pair, {
        side: OrderSide.BUY,
        size: '200',
        sizeInCounter: true,
      });

      expect(order.type).toBe(OrderType.MARKET);
      expect(order.id).toBe('order-123');
      expect(order.size).toBe('200');
      expect(mockMethods.postOrder).toHaveBeenCalledWith({
        client_order_id: uuidMatcher,
        notional: '200',
        side: 'buy',
        symbol: 'SHOP',
        time_in_force: 'day',
        type: 'market',
      });
    });

    it('places a stock LIMIT SELL order with gtc for whole shares', async () => {
      mockMethods.postOrder.mockResolvedValue(
        anOrder({
          id: 'order-456',
          limit_price: '100',
          notional: null,
          qty: '5',
          side: AlpacaOrderSide.SELL,
          type: AlpacaOrderType.LIMIT,
        })
      );

      const pair = new TradingPair('SHOP', 'USD');
      const order = await exchange.placeLimitOrder(pair, {
        price: '100',
        side: OrderSide.SELL,
        size: '5',
      });

      expect(order.type).toBe(OrderType.LIMIT);
      expect(order.id).toBe('order-456');
      expect(mockMethods.postOrder).toHaveBeenCalledWith({
        client_order_id: uuidMatcher,
        limit_price: '100',
        qty: '5',
        side: 'sell',
        symbol: 'SHOP',
        time_in_force: 'gtc',
        type: 'limit',
      });
    });

    it('places a stock LIMIT SELL order with day and extended hours for fractional shares', async () => {
      mockMethods.postOrder.mockResolvedValue(
        anOrder({
          id: 'order-frac',
          limit_price: '100',
          notional: null,
          qty: '5.5',
          side: AlpacaOrderSide.SELL,
          type: AlpacaOrderType.LIMIT,
        })
      );

      const pair = new TradingPair('SHOP', 'USD');
      const order = await exchange.placeLimitOrder(pair, {
        price: '100',
        side: OrderSide.SELL,
        size: '5.5',
      });

      expect(order.type).toBe(OrderType.LIMIT);
      expect(order.id).toBe('order-frac');
      expect(mockMethods.postOrder).toHaveBeenCalledWith({
        client_order_id: uuidMatcher,
        extended_hours: true,
        limit_price: '100',
        qty: '5.5',
        side: 'sell',
        symbol: 'SHOP',
        time_in_force: 'day',
        type: 'limit',
      });
    });

    it('uses gtc time_in_force for crypto orders', async () => {
      mockMethods.getCryptoBarsLatest.mockResolvedValue({
        bars: {'BTC/USD': aBar(1)},
      });
      mockMethods.postOrder.mockResolvedValue(
        anOrder({
          id: 'order-789',
          notional: '100',
          qty: null,
          side: AlpacaOrderSide.BUY,
          type: AlpacaOrderType.MARKET,
        })
      );

      const pair = new TradingPair('BTC', 'USD');
      await exchange.placeMarketOrder(pair, {
        side: OrderSide.BUY,
        size: '100',
        sizeInCounter: true,
      });

      expect(mockMethods.postOrder).toHaveBeenCalledWith({
        client_order_id: uuidMatcher,
        notional: '100',
        side: 'buy',
        symbol: 'BTC/USD',
        time_in_force: 'gtc',
        type: 'market',
      });
    });

    it('sends a fresh client_order_id (UUID) with every placement so operators can reconcile failed submissions', async () => {
      mockMethods.postOrder.mockResolvedValue(
        anOrder({
          id: 'order-123',
          notional: '200',
          qty: null,
          side: AlpacaOrderSide.BUY,
          type: AlpacaOrderType.MARKET,
        })
      );

      const pair = new TradingPair('SHOP', 'USD');
      const options = {side: OrderSide.BUY, size: '200', sizeInCounter: true} as const;
      await exchange.placeMarketOrder(pair, options);
      await exchange.placeMarketOrder(pair, options);

      const clientOrderIds = mockMethods.postOrder.mock.calls.map(call => {
        const [params] = call;
        return params.client_order_id;
      });
      expect(clientOrderIds).toHaveLength(2);
      for (const clientOrderId of clientOrderIds) {
        expect(clientOrderId).toSatisfy(isUuid);
      }
      expect(new Set(clientOrderIds).size).toBe(2);
    });
  });

  describe('cancelOpenOrders', () => {
    it('cancels all open orders for a pair', async () => {
      mockMethods.getOrders.mockResolvedValue([anOrder({id: 'open-1'}), anOrder({id: 'open-2'})]);
      mockMethods.deleteOrder.mockResolvedValue(undefined);

      const pair = new TradingPair('SHOP', 'USD');
      const canceledIds = await exchange.cancelOpenOrders(pair);

      expect(canceledIds).toEqual(['open-1', 'open-2']);
      expect(mockMethods.deleteOrder).toHaveBeenCalledTimes(2);
      expect(mockMethods.deleteOrder).toHaveBeenCalledWith('open-1');
      expect(mockMethods.deleteOrder).toHaveBeenCalledWith('open-2');
    });

    it('ignores orders that filled between fetching and canceling them', async () => {
      mockMethods.getOrders.mockResolvedValue([anOrder({id: 'open-1'})]);
      mockMethods.deleteOrder.mockRejectedValue(
        new SimplifiedHttpError({
          data: {code: 42210000, message: 'order is already in "filled" state'},
          status: 422,
        })
      );

      const pair = new TradingPair('SHOP', 'USD');
      const canceledIds = await exchange.cancelOpenOrders(pair);

      expect(canceledIds).toEqual(['open-1']);
    });

    it('rethrows unexpected cancellation errors', async () => {
      mockMethods.getOrders.mockResolvedValue([anOrder({id: 'open-1'})]);
      mockMethods.deleteOrder.mockRejectedValue(
        new SimplifiedHttpError({data: {message: 'internal server error'}, status: 500})
      );

      const pair = new TradingPair('SHOP', 'USD');

      await expect(exchange.cancelOpenOrders(pair)).rejects.toThrow('500 Unknown Error');
    });
  });

  describe('watchOrders', () => {
    it('returns a topic ID and establishes a trading stream connection', async () => {
      const topicId = await exchange.watchOrders();

      expect(topicId).toBeDefined();
      expect(mockTradingWebSocket.connect).toHaveBeenCalledTimes(1);
      expect(mockTradingWebSocket.onTradeUpdate).toHaveBeenCalledWith('trading-conn', expect.any(Function));
    });

    it('reuses the existing connection on subsequent calls', async () => {
      await exchange.watchOrders();
      await exchange.watchOrders();

      expect(mockTradingWebSocket.connect).toHaveBeenCalledTimes(1);
      expect(mockTradingWebSocket.onTradeUpdate).toHaveBeenCalledTimes(2);
    });

    it('emits Fill on fill events', async () => {
      const topicId = await exchange.watchOrders();

      const fillHandler = vi.fn();
      exchange.on(topicId, fillHandler);

      // Get the registered callback and simulate a fill event
      const registeredCb = mockTradingWebSocket.onTradeUpdate.mock.calls[0]?.[1];
      registeredCb({
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
          id: 'order-fill-1',
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
          symbol: 'AAPL',
          time_in_force: 'day',
          type: AlpacaOrderType.MARKET,
          updated_at: '2025-01-15T14:30:01.123Z',
        },
        price: '150.25',
        qty: '10',
        timestamp: '2025-01-15T14:30:01.123Z',
      });

      expect(fillHandler).toHaveBeenCalledTimes(1);
      expect(fillHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          order_id: 'order-fill-1',
          price: '150.25',
          side: OrderSide.BUY,
          size: '10',
        })
      );
    });

    it('derives the crypto fee on a streamed fill', async () => {
      const topicId = await exchange.watchOrders();
      const fillHandler = vi.fn();
      exchange.on(topicId, fillHandler);

      const registeredCb = mockTradingWebSocket.onTradeUpdate.mock.calls[0]?.[1];
      registeredCb?.({
        event: TradeUpdateEvent.FILL,
        order: anOrder({
          asset_class: AlpacaAssetClass.CRYPTO,
          filled_avg_price: '61234.5',
          filled_qty: '2.5',
          id: 'crypto-stream-buy',
          side: AlpacaOrderSide.BUY,
          symbol: 'BTC/USD',
          type: AlpacaOrderType.MARKET,
        }),
        price: '61234.5',
        qty: '2.5',
        timestamp: '2024-05-06T09:00:00.600000Z',
      });

      expect(fillHandler).toHaveBeenCalledWith(
        expect.objectContaining({fee: '0.00625', feeAsset: 'BTC', order_id: 'crypto-stream-buy'})
      );
    });

    it('does not emit on non-fill events', async () => {
      const topicId = await exchange.watchOrders();

      const fillHandler = vi.fn();
      exchange.on(topicId, fillHandler);

      const registeredCb = mockTradingWebSocket.onTradeUpdate.mock.calls[0]?.[1];
      registeredCb({
        event: TradeUpdateEvent.NEW,
        order: {
          asset_class: AlpacaAssetClass.US_EQUITY,
          asset_id: 'test-asset',
          canceled_at: null,
          client_order_id: 'test-client',
          created_at: '2025-01-15T14:30:00.000Z',
          expired_at: null,
          extended_hours: false,
          failed_at: null,
          filled_at: null,
          filled_avg_price: null,
          filled_qty: '0',
          id: 'order-new-1',
          legs: null,
          limit_price: '150',
          notional: null,
          qty: '10',
          replaced_at: null,
          replaced_by: null,
          replaces: null,
          side: AlpacaOrderSide.BUY,
          status: 'new',
          stop_price: null,
          submitted_at: '2025-01-15T14:30:00.001Z',
          symbol: 'AAPL',
          time_in_force: 'day',
          type: AlpacaOrderType.LIMIT,
          updated_at: '2025-01-15T14:30:00.001Z',
        },
      });

      expect(fillHandler).not.toHaveBeenCalled();
    });
  });

  describe('unwatchOrders', () => {
    it('removes the listener and cleans up', async () => {
      const topicId = await exchange.watchOrders();
      exchange.unwatchOrders(topicId);

      expect(mockTradingWebSocket.offTradeUpdate).toHaveBeenCalledWith('trading-conn', expect.any(Function));
    });
  });

  describe('disconnect', () => {
    it('cleans up trading stream connection', async () => {
      await exchange.watchOrders();
      exchange.disconnect();

      expect(mockTradingWebSocket.disconnect).toHaveBeenCalledWith('trading-conn');
    });
  });
});
