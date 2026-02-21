import Big from 'big.js';
import {describe, expect, it, vi, beforeEach} from 'vitest';
import {TradingPair} from '../TradingPair.js';
import {ExchangeOrderPosition, ExchangeOrderSide, ExchangeOrderType} from '../Exchange.js';
import {AssetClass, OrderSide, OrderStatus, OrderType} from './api/schema/OrderSchema.js';
import {PositionSide} from './api/schema/PositionSchema.js';
import {TradeUpdateEvent} from './api/schema/TradingStreamSchema.js';

// Shared mock references
const mockMethods = {
  deleteOrder: vi.fn(),
  getAccount: vi.fn(),
  getAssets: vi.fn(),
  getClock: vi.fn(),
  getCryptoBars: vi.fn(),
  getCryptoBarsLatest: vi.fn().mockResolvedValue({bars: {}}),
  getOrders: vi.fn(),
  getPositions: vi.fn(),
  getStockBars: vi.fn(),
  getStockBarsLatest: vi.fn(),
  postOrder: vi.fn(),
};

vi.mock('./api/AlpacaAPI.js', () => ({
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
  },
}));

vi.mock('./AlpacaWebSocket.js', () => ({
  alpacaWebSocket: {
    connect: vi.fn(),
    subscribeToBars: vi.fn(),
    unsubscribeFromBars: vi.fn(),
  },
}));

const mockTradingWebSocket = {
  connect: vi.fn().mockResolvedValue({connectionId: 'trading-conn', stream: {}}),
  disconnect: vi.fn(),
  offTradeUpdate: vi.fn(),
  onTradeUpdate: vi.fn(),
};

vi.mock('./AlpacaTradingWebSocket.js', () => ({
  alpacaTradingWebSocket: mockTradingWebSocket,
}));

// Import after mocking
const {AlpacaExchange} = await import('./AlpacaExchange.js');

describe.sequential('AlpacaExchange', () => {
  let exchange: InstanceType<typeof AlpacaExchange>;

  beforeEach(() => {
    vi.clearAllMocks();
    exchange = new AlpacaExchange({apiKey: 'test', apiSecret: 'test', usePaperTrading: true});
    // Default: stock symbol (empty crypto bars)
    mockMethods.getCryptoBarsLatest.mockResolvedValue({bars: {}});
  });

  describe('getFeeRates', () => {
    it('returns hardcoded Alpaca fee rates', async () => {
      const pair = new TradingPair('SHOP', 'USD');
      const fees = await exchange.getFeeRates(pair);

      expect(fees[ExchangeOrderType.MARKET]).toEqual(new Big(0.0025));
      expect(fees[ExchangeOrderType.LIMIT]).toEqual(new Big(0.0015));
    });
  });

  describe('listBalances', () => {
    it('returns positions and account cash', async () => {
      mockMethods.getPositions.mockResolvedValue([
        {asset_class: 'us_equity', qty: '3', side: PositionSide.LONG, symbol: 'SHOP'},
      ]);
      mockMethods.getAccount.mockResolvedValue({cash: '500.50', currency: 'USD', last_equity: '30000'});

      const balances = await exchange.listBalances();

      expect(balances).toHaveLength(2);
      expect(balances[0]).toEqual({available: '3', currency: 'SHOP', hold: '0', position: ExchangeOrderPosition.LONG});
      expect(balances[1]).toEqual({
        available: '500.5',
        currency: 'USD',
        hold: '0',
        position: ExchangeOrderPosition.LONG,
      });
    });

    it('trims crypto USD suffix from symbol', async () => {
      mockMethods.getPositions.mockResolvedValue([
        {asset_class: 'crypto', qty: '100', side: PositionSide.LONG, symbol: 'USDTUSD'},
      ]);
      mockMethods.getAccount.mockResolvedValue({cash: '0', currency: 'USD', last_equity: '30000'});

      const balances = await exchange.listBalances();
      expect(balances[0]!.currency).toBe('USDT');
    });

    it('uses absolute values for SHORT positions', async () => {
      mockMethods.getPositions.mockResolvedValue([
        {asset_class: 'us_equity', qty: '-3', side: PositionSide.SHORT, symbol: 'TSLA'},
      ]);
      mockMethods.getAccount.mockResolvedValue({cash: '0', currency: 'USD', last_equity: '30000'});

      const balances = await exchange.listBalances();
      expect(balances[0]).toEqual({
        available: '3',
        currency: 'TSLA',
        hold: '0',
        position: ExchangeOrderPosition.SHORT,
      });
    });

    it('throws an error when Alpaca returns an unknown position side', async () => {
      mockMethods.getPositions.mockResolvedValue([
        {asset_class: 'us_equity', qty: '3', side: 'unknown', symbol: 'SHOP'},
      ]);
      mockMethods.getAccount.mockResolvedValue({cash: '0', currency: 'USD', last_equity: '30000'});

      await expect(exchange.listBalances()).rejects.toThrow();
    });
  });

  describe('getFills', () => {
    it('returns only filled orders mapped to ExchangeFill', async () => {
      const filledOrder = {
        asset_class: AssetClass.US_EQUITY,
        created_at: '2023-08-21T15:57:26.195019Z',
        filled_avg_price: '53.05',
        filled_qty: '3',
        id: 'order-1',
        side: OrderSide.BUY,
        status: OrderStatus.FILLED,
      };

      const canceledOrder = {
        ...filledOrder,
        id: 'order-2',
        status: OrderStatus.CANCELED,
        filled_avg_price: null,
        filled_qty: '0',
      };

      mockMethods.getOrders.mockResolvedValue([filledOrder, canceledOrder]);

      const pair = new TradingPair('SHOP', 'USD');
      const fills = await exchange.getFills(pair);

      expect(fills).toHaveLength(1);
      expect(fills[0]!.order_id).toBe('order-1');
      expect(fills[0]!.price).toBe('53.05');
      expect(fills[0]!.side).toBe(ExchangeOrderSide.BUY);
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
        bars: {'BTC/USD': {c: 1, h: 1, l: 1, n: 1, o: 1, t: '', v: 1, vw: 1}},
      });
      mockMethods.getAssets.mockResolvedValue([
        {
          class: 'crypto',
          min_order_size: '0.0001',
          min_trade_increment: '0.0001',
          price_increment: '0.01',
          symbol: 'BTC/USD',
        },
      ]);

      const pair = new TradingPair('BTC', 'USD');
      const rules = await exchange.getTradingRules(pair);

      expect(rules.base_min_size).toBe('0.0001');
      expect(rules.base_increment).toBe('0.0001');
      expect(rules.counter_increment).toBe('0.01');
      expect(rules.counter_min_size).toBe('1');
    });

    it('returns stock trading rules with hardcoded defaults', async () => {
      mockMethods.getAssets.mockResolvedValue([{class: 'us_equity', symbol: 'SHOP'}]);

      const pair = new TradingPair('SHOP', 'USD');
      const rules = await exchange.getTradingRules(pair);

      expect(rules.base_min_size).toBe('0');
      expect(rules.base_increment).toBe('0.00000001');
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
    it('places a stock MARKET BUY order with notional amount', async () => {
      mockMethods.postOrder.mockResolvedValue({
        id: 'order-123',
        notional: '200',
        qty: null,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
      });

      const pair = new TradingPair('SHOP', 'USD');
      const order = await exchange.placeMarketOrder(pair, {
        side: ExchangeOrderSide.BUY,
        size: '200',
        sizeInCounter: true,
      });

      expect(order.type).toBe(ExchangeOrderType.MARKET);
      expect(order.id).toBe('order-123');
      expect(order.size).toBe('200');
      expect(mockMethods.postOrder).toHaveBeenCalledWith({
        notional: '200',
        side: 'buy',
        symbol: 'SHOP',
        time_in_force: 'day',
        type: 'market',
      });
    });

    it('places a stock LIMIT SELL order with gtc for whole shares', async () => {
      mockMethods.postOrder.mockResolvedValue({
        id: 'order-456',
        limit_price: '100',
        notional: null,
        qty: '5',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
      });

      const pair = new TradingPair('SHOP', 'USD');
      const order = await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.SELL,
        size: '5',
        price: '100',
      });

      expect(order.type).toBe(ExchangeOrderType.LIMIT);
      expect(order.id).toBe('order-456');
      expect(mockMethods.postOrder).toHaveBeenCalledWith({
        limit_price: '100',
        qty: '5',
        side: 'sell',
        symbol: 'SHOP',
        time_in_force: 'gtc',
        type: 'limit',
      });
    });

    it('places a stock LIMIT SELL order with day and extended hours for fractional shares', async () => {
      mockMethods.postOrder.mockResolvedValue({
        id: 'order-frac',
        limit_price: '100',
        notional: null,
        qty: '5.5',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
      });

      const pair = new TradingPair('SHOP', 'USD');
      const order = await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.SELL,
        size: '5.5',
        price: '100',
      });

      expect(order.type).toBe(ExchangeOrderType.LIMIT);
      expect(order.id).toBe('order-frac');
      expect(mockMethods.postOrder).toHaveBeenCalledWith({
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
        bars: {'BTC/USD': {c: 1, h: 1, l: 1, n: 1, o: 1, t: '', v: 1, vw: 1}},
      });
      mockMethods.postOrder.mockResolvedValue({
        id: 'order-789',
        notional: '100',
        qty: null,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
      });

      const pair = new TradingPair('BTC', 'USD');
      await exchange.placeMarketOrder(pair, {
        side: ExchangeOrderSide.BUY,
        size: '100',
        sizeInCounter: true,
      });

      expect(mockMethods.postOrder).toHaveBeenCalledWith({
        notional: '100',
        side: 'buy',
        symbol: 'BTC/USD',
        time_in_force: 'gtc',
        type: 'market',
      });
    });
  });

  describe('cancelOpenOrders', () => {
    it('cancels all open orders for a pair', async () => {
      mockMethods.getOrders.mockResolvedValue([{id: 'open-1'}, {id: 'open-2'}]);
      mockMethods.deleteOrder.mockResolvedValue(undefined);

      const pair = new TradingPair('SHOP', 'USD');
      const canceledIds = await exchange.cancelOpenOrders(pair);

      expect(canceledIds).toEqual(['open-1', 'open-2']);
      expect(mockMethods.deleteOrder).toHaveBeenCalledTimes(2);
      expect(mockMethods.deleteOrder).toHaveBeenCalledWith('open-1');
      expect(mockMethods.deleteOrder).toHaveBeenCalledWith('open-2');
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

    it('emits ExchangeFill on fill events', async () => {
      const topicId = await exchange.watchOrders();

      const fillHandler = vi.fn();
      exchange.on(topicId, fillHandler);

      // Get the registered callback and simulate a fill event
      const registeredCb = mockTradingWebSocket.onTradeUpdate.mock.calls[0]![1];
      registeredCb({
        event: TradeUpdateEvent.FILL,
        order: {
          asset_class: AssetClass.US_EQUITY,
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
          side: OrderSide.BUY,
          status: OrderStatus.FILLED,
          stop_price: null,
          submitted_at: '2025-01-15T14:30:00.001Z',
          symbol: 'AAPL',
          time_in_force: 'day',
          type: OrderType.MARKET,
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
          side: ExchangeOrderSide.BUY,
          size: '10',
        })
      );
    });

    it('does not emit on non-fill events', async () => {
      const topicId = await exchange.watchOrders();

      const fillHandler = vi.fn();
      exchange.on(topicId, fillHandler);

      const registeredCb = mockTradingWebSocket.onTradeUpdate.mock.calls[0]![1];
      registeredCb({
        event: TradeUpdateEvent.NEW,
        order: {
          asset_class: AssetClass.US_EQUITY,
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
          side: OrderSide.BUY,
          status: 'new',
          stop_price: null,
          submitted_at: '2025-01-15T14:30:00.001Z',
          symbol: 'AAPL',
          time_in_force: 'day',
          type: OrderType.LIMIT,
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
