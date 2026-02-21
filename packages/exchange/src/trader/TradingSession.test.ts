import Big from 'big.js';
import {EventEmitter} from 'node:events';
import {TradingSession} from './TradingSession.js';
import {TradingPair} from '../exchange/TradingPair.js';
import {
  ExchangeOrderPosition,
  ExchangeOrderSide,
  ExchangeOrderType,
  type ExchangeCandle,
  type ExchangeFeeRate,
  type ExchangeFill,
  type ExchangePendingLimitOrder,
  type ExchangePendingMarketOrder,
  type ExchangeTradingRules,
} from '../exchange/Exchange.js';
import type {OrderAdvice, TradingSessionStrategy} from './TradingSessionTypes.js';

const pair = new TradingPair('TSLA', 'USD');
const candleInterval = 60_000;

const tradingRules: ExchangeTradingRules = {
  base_increment: '0.001',
  base_max_size: '10000',
  base_min_size: '0.01',
  counter_increment: '0.01',
  counter_min_size: '1',
  pair,
};

const feeRates: ExchangeFeeRate = {
  [ExchangeOrderType.LIMIT]: new Big('0.001'),
  [ExchangeOrderType.MARKET]: new Big('0.002'),
};

const sampleFill: ExchangeFill = {
  created_at: '2024-01-01T00:00:00.000Z',
  fee: '0.01',
  feeAsset: 'USD',
  order_id: 'order-1',
  pair,
  position: ExchangeOrderPosition.LONG,
  price: '250.00',
  side: ExchangeOrderSide.BUY,
  size: '1',
};

const sampleCandle: ExchangeCandle = {
  base: 'TSLA',
  counter: 'USD',
  open: '250.00',
  high: '255.00',
  low: '248.00',
  close: '253.00',
  volume: '1000',
  openTimeInISO: '2024-01-01T00:00:00.000Z',
  openTimeInMillis: 1704067200000,
  sizeInMillis: 60_000,
};

function createMockExchange() {
  const exchange = new EventEmitter() as EventEmitter & {
    getTradingRules: ReturnType<typeof vi.fn>;
    getFeeRates: ReturnType<typeof vi.fn>;
    cancelOpenOrders: ReturnType<typeof vi.fn>;
    getOpenOrders: ReturnType<typeof vi.fn>;
    getAvailableBalances: ReturnType<typeof vi.fn>;
    getFills: ReturnType<typeof vi.fn>;
    watchCandles: ReturnType<typeof vi.fn>;
    watchOrders: ReturnType<typeof vi.fn>;
    unwatchCandles: ReturnType<typeof vi.fn>;
    unwatchOrders: ReturnType<typeof vi.fn>;
    placeLimitOrder: ReturnType<typeof vi.fn>;
    placeMarketOrder: ReturnType<typeof vi.fn>;
  };

  exchange.getTradingRules = vi.fn().mockResolvedValue(tradingRules);
  exchange.getFeeRates = vi.fn().mockResolvedValue(feeRates);
  exchange.cancelOpenOrders = vi.fn().mockResolvedValue([]);
  exchange.getOpenOrders = vi.fn().mockResolvedValue([]);
  exchange.getAvailableBalances = vi.fn().mockResolvedValue({base: new Big('10'), counter: new Big('5000')});
  exchange.getFills = vi.fn().mockResolvedValue([sampleFill]);
  exchange.watchCandles = vi.fn().mockResolvedValue('candle-topic-1');
  exchange.watchOrders = vi.fn().mockResolvedValue('order-topic-1');
  exchange.unwatchCandles = vi.fn();
  exchange.unwatchOrders = vi.fn();
  exchange.placeLimitOrder = vi.fn().mockResolvedValue({
    id: 'order-1',
    pair,
    side: ExchangeOrderSide.SELL,
    size: '10',
    type: ExchangeOrderType.LIMIT,
    price: '253.00',
  } satisfies ExchangePendingLimitOrder);
  exchange.placeMarketOrder = vi.fn().mockResolvedValue({
    id: 'order-2',
    pair,
    side: ExchangeOrderSide.BUY,
    size: '5000',
    type: ExchangeOrderType.MARKET,
  } satisfies ExchangePendingMarketOrder);

  return exchange;
}

function createMockStrategy(): TradingSessionStrategy & {onCandle: ReturnType<typeof vi.fn>; onFill: ReturnType<typeof vi.fn>} {
  return {
    onCandle: vi.fn().mockResolvedValue(undefined),
    onFill: vi.fn().mockResolvedValue(undefined),
  };
}

describe.sequential('TradingSession', () => {
  let exchange: ReturnType<typeof createMockExchange>;
  let strategy: ReturnType<typeof createMockStrategy>;
  let session: TradingSession;

  beforeEach(() => {
    vi.clearAllMocks();
    exchange = createMockExchange();
    strategy = createMockStrategy();
    // Cast needed because mock exchange doesn't have all abstract methods
    session = new TradingSession({exchange: exchange as any, pair, strategy, candleInterval});
  });

  describe('start', () => {
    it('initializes state and subscribes to WebSocket topics', async () => {
      const onStarted = vi.fn();
      session.on('started', onStarted);

      await session.start();

      expect(exchange.getTradingRules).toHaveBeenCalledWith(pair);
      expect(exchange.getFeeRates).toHaveBeenCalledWith(pair);
      expect(exchange.getOpenOrders).toHaveBeenCalledWith(pair);
      expect(exchange.getAvailableBalances).toHaveBeenCalledWith(pair);
      expect(exchange.getFills).toHaveBeenCalledWith(pair);
      expect(exchange.watchCandles).toHaveBeenCalledWith(pair, candleInterval, expect.any(String));
      expect(exchange.watchOrders).toHaveBeenCalled();
      expect(session.running).toBe(true);
      expect(onStarted).toHaveBeenCalledTimes(1);
    });

    it('throws if already running', async () => {
      await session.start();
      await expect(session.start()).rejects.toThrow('TradingSession is already running');
    });

    it('picks up all previously placed open orders', async () => {
      const existingOrders: ExchangePendingLimitOrder[] = [
        {id: 'previous-order-1', pair, side: ExchangeOrderSide.BUY, size: '5', type: ExchangeOrderType.LIMIT, price: '240.00'},
        {id: 'previous-order-2', pair, side: ExchangeOrderSide.SELL, size: '3', type: ExchangeOrderType.LIMIT, price: '260.00'},
      ];
      exchange.getOpenOrders.mockResolvedValue(existingOrders);

      await session.start();

      exchange.getAvailableBalances.mockResolvedValue({base: new Big('15'), counter: new Big('3800')});
      const onFill = vi.fn();
      session.on('fill', onFill);

      // Fill for the second open order is recognized
      const fill: ExchangeFill = {...sampleFill, order_id: 'previous-order-2', side: ExchangeOrderSide.SELL};
      exchange.emit('order-topic-1', fill);

      await vi.waitFor(() => expect(onFill).toHaveBeenCalledTimes(1));
      expect(strategy.onFill).toHaveBeenCalled();
    });
  });

  describe('candle handling', () => {
    it('forwards candles to strategy', async () => {
      await session.start();

      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(strategy.onCandle).toHaveBeenCalledTimes(1));

      const [batchedCandle, state] = strategy.onCandle.mock.calls[0];
      expect(batchedCandle.close).toBeInstanceOf(Big);
      expect(batchedCandle.close.eq('253.00')).toBe(true);
      expect(state.baseBalance.eq('10')).toBe(true);
      expect(state.counterBalance.eq('5000')).toBe(true);
      expect(state.lastOrderSide).toBe(ExchangeOrderSide.BUY);
    });

    it('emits candle event', async () => {
      const onCandle = vi.fn();
      session.on('candle', onCandle);
      await session.start();

      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(onCandle).toHaveBeenCalledTimes(1));
    });
  });

  describe('order execution', () => {
    it('places a MARKET BUY when strategy returns advice', async () => {
      const advice: OrderAdvice = {
        side: ExchangeOrderSide.BUY,
        type: ExchangeOrderType.MARKET,
        amount: null,
        amountInCounter: true,
      };
      strategy.onCandle.mockResolvedValue(advice);

      await session.start();

      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(exchange.placeMarketOrder).toHaveBeenCalledTimes(1));

      expect(exchange.placeMarketOrder).toHaveBeenCalledWith(pair, {
        side: ExchangeOrderSide.BUY,
        size: '5000',
        sizeInCounter: true,
      });
    });

    it('places a LIMIT SELL with precision-applied price', async () => {
      const advice: OrderAdvice = {
        side: ExchangeOrderSide.SELL,
        type: ExchangeOrderType.LIMIT,
        amount: '5.5678',
        amountInCounter: false,
        price: '253.456',
      };
      strategy.onCandle.mockResolvedValue(advice);

      await session.start();

      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(exchange.placeLimitOrder).toHaveBeenCalledTimes(1));

      // base_increment=0.001 → 5.5678 rounds down to 5.567
      // counter_increment=0.01 → 253.456 rounds down to 253.45
      expect(exchange.placeLimitOrder).toHaveBeenCalledWith(pair, {
        side: ExchangeOrderSide.SELL,
        size: '5.567',
        price: '253.45',
      });
    });

    it('resolves null amount SELL to full base balance', async () => {
      const advice: OrderAdvice = {
        side: ExchangeOrderSide.SELL,
        type: ExchangeOrderType.MARKET,
        amount: null,
        amountInCounter: false,
      };
      strategy.onCandle.mockResolvedValue(advice);

      await session.start();

      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(exchange.placeMarketOrder).toHaveBeenCalledTimes(1));

      // base balance=10, base_increment=0.001 → 10
      expect(exchange.placeMarketOrder).toHaveBeenCalledWith(pair, {
        side: ExchangeOrderSide.SELL,
        size: '10',
        sizeInCounter: false,
      });
    });

    it('resolves null amount LIMIT BUY to counter balance / price', async () => {
      const advice: OrderAdvice = {
        side: ExchangeOrderSide.BUY,
        type: ExchangeOrderType.LIMIT,
        amount: null,
        amountInCounter: false,
        price: '250',
      };
      strategy.onCandle.mockResolvedValue(advice);

      await session.start();

      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(exchange.placeLimitOrder).toHaveBeenCalledTimes(1));

      // counter=5000, price=250 → 5000/250 = 20, base_increment=0.001 → 20
      expect(exchange.placeLimitOrder).toHaveBeenCalledWith(pair, {
        side: ExchangeOrderSide.BUY,
        size: '20',
        price: '250',
      });
    });

    it('cancels existing order before placing a new one', async () => {
      const advice: OrderAdvice = {
        side: ExchangeOrderSide.BUY,
        type: ExchangeOrderType.MARKET,
        amount: '100',
        amountInCounter: true,
      };
      strategy.onCandle.mockResolvedValue(advice);

      await session.start();

      // First candle → places order
      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(exchange.placeMarketOrder).toHaveBeenCalledTimes(1));

      // cancelOpenOrders was called once during start, reset to track new calls
      const cancelCallsAfterStart = exchange.cancelOpenOrders.mock.calls.length;

      // Second candle → should cancel the pending order first
      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(exchange.placeMarketOrder).toHaveBeenCalledTimes(2));

      // One extra cancel call for clearing the pending order
      expect(exchange.cancelOpenOrders.mock.calls.length).toBeGreaterThan(cancelCallsAfterStart);
    });
  });

  describe('fill handling', () => {
    it('updates state when matching fill arrives', async () => {
      const advice: OrderAdvice = {
        side: ExchangeOrderSide.BUY,
        type: ExchangeOrderType.MARKET,
        amount: '100',
        amountInCounter: true,
      };
      strategy.onCandle.mockResolvedValue(advice);

      await session.start();

      // Trigger an order
      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(exchange.placeMarketOrder).toHaveBeenCalledTimes(1));

      // Update balances for post-fill
      exchange.getAvailableBalances.mockResolvedValue({base: new Big('10.4'), counter: new Big('4900')});

      const onFill = vi.fn();
      session.on('fill', onFill);

      // Emit matching fill (order-2 = the market order id)
      const fill: ExchangeFill = {...sampleFill, order_id: 'order-2', side: ExchangeOrderSide.BUY};
      exchange.emit('order-topic-1', fill);

      await vi.waitFor(() => expect(onFill).toHaveBeenCalledTimes(1));
      expect(strategy.onFill).toHaveBeenCalledWith(fill, expect.objectContaining({
        baseBalance: expect.any(Big),
        counterBalance: expect.any(Big),
        lastOrderSide: ExchangeOrderSide.BUY,
      }));
    });

    it('ignores fills with non-matching order ID', async () => {
      const advice: OrderAdvice = {
        side: ExchangeOrderSide.BUY,
        type: ExchangeOrderType.MARKET,
        amount: '100',
        amountInCounter: true,
      };
      strategy.onCandle.mockResolvedValue(advice);

      await session.start();

      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(exchange.placeMarketOrder).toHaveBeenCalledTimes(1));

      const onFill = vi.fn();
      session.on('fill', onFill);

      // Emit fill with non-matching order ID
      const fill: ExchangeFill = {...sampleFill, order_id: 'unrelated-order'};
      exchange.emit('order-topic-1', fill);

      // Give it time to process, then verify no fill event
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(onFill).not.toHaveBeenCalled();
      expect(strategy.onFill).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('emits error when order size is below minimum', async () => {
      exchange.getAvailableBalances.mockResolvedValue({base: new Big('0.001'), counter: new Big('5000')});
      const advice: OrderAdvice = {
        side: ExchangeOrderSide.SELL,
        type: ExchangeOrderType.MARKET,
        amount: null,
        amountInCounter: false,
      };
      strategy.onCandle.mockResolvedValue(advice);

      const onError = vi.fn();
      session.on('error', onError);

      await session.start();

      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

      expect(onError.mock.calls[0][0].message).toContain('below minimum base size');
      expect(exchange.placeMarketOrder).not.toHaveBeenCalled();
    });

    it('emits error when strategy.onCandle throws', async () => {
      strategy.onCandle.mockRejectedValue(new Error('Strategy crashed'));

      const onError = vi.fn();
      session.on('error', onError);

      await session.start();

      exchange.emit('candle-topic-1', sampleCandle);
      await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

      expect(onError.mock.calls[0][0].message).toBe('Strategy crashed');
    });
  });

  describe('stop', () => {
    it('cleans up subscriptions and emits stopped', async () => {
      const onStopped = vi.fn();
      session.on('stopped', onStopped);

      await session.start();
      await session.stop();

      expect(exchange.unwatchCandles).toHaveBeenCalledWith('candle-topic-1');
      expect(exchange.unwatchOrders).toHaveBeenCalledWith('order-topic-1');
      expect(session.running).toBe(false);
      expect(onStopped).toHaveBeenCalledTimes(1);
    });
  });
});
