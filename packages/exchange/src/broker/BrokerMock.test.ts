import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {BrokerMock, type ExchangeMockBalance} from './BrokerMock.js';
import {type Candle, type FeeRate, type Fill, OrderSide, OrderType, type TradingRules} from './Broker.js';
import {TradingPair} from './TradingPair.js';
import {ms} from 'ms';

class TestExchangeMock extends BrokerMock {
  static readonly TEST_FEE_RATES: FeeRate = {
    [OrderType.LIMIT]: new Big(0.0015),
    [OrderType.MARKET]: new Big(0.0025),
  };

  static readonly TEST_TRADING_RULES = {
    base_increment: '0.0001',
    base_max_size: String(Number.MAX_SAFE_INTEGER),
    base_min_size: '0.0001',
    counter_increment: '0.01',
    counter_min_size: '1',
  };

  constructor(balances: Map<string, ExchangeMockBalance>) {
    super({balances});
    this.setCachedFeeRates(TestExchangeMock.TEST_FEE_RATES);
  }

  async getFeeRates(): Promise<FeeRate> {
    return TestExchangeMock.TEST_FEE_RATES;
  }

  async getTradingRules(pair: TradingPair): Promise<TradingRules> {
    return {...TestExchangeMock.TEST_TRADING_RULES, pair};
  }

  getName() {
    return 'TestExchange';
  }

  getSmallestInterval() {
    return ms('1m');
  }
}

const pair = new TradingPair('BTC', 'USD');

function createCandle(overrides: Partial<Candle> & {open: string; close: string}): Candle {
  const openNum = parseFloat(overrides.open);
  const closeNum = parseFloat(overrides.close);
  return {
    base: 'BTC',
    close: overrides.close,
    counter: 'USD',
    high: overrides.high ?? String(Math.max(openNum, closeNum)),
    low: overrides.low ?? String(Math.min(openNum, closeNum)),
    open: overrides.open,
    openTimeInISO: overrides.openTimeInISO ?? '2025-01-01T00:00:00.000Z',
    openTimeInMillis: overrides.openTimeInMillis ?? 1735689600000,
    sizeInMillis: overrides.sizeInMillis ?? 60000,
    volume: overrides.volume ?? '100',
  };
}

function createExchange(baseAmount: string, counterAmount: string) {
  return new TestExchangeMock(
    new Map([
      ['BTC', {available: new Big(baseAmount), hold: new Big(0)}],
      ['USD', {available: new Big(counterAmount), hold: new Big(0)}],
    ])
  );
}

describe('BrokerMock', () => {
  describe('market orders', () => {
    it('fills market buy order at the next candle open price', async () => {
      const exchange = createExchange('0', '10000');

      // Process first candle to set current state
      exchange.processCandle(createCandle({close: '100', open: '100'}));

      // Place market buy order
      await exchange.placeMarketOrder(pair, {
        side: OrderSide.BUY,
        size: '1',
        sizeInCounter: false,
      });

      // Process next candle — order should fill at this candle's open
      const fills = exchange.processCandle(
        createCandle({close: '110', open: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      expect(fills[0].price).toBe('105');
      expect(fills[0].side).toBe(OrderSide.BUY);
    });

    it('fills market sell order at the next candle open price', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      await exchange.placeMarketOrder(pair, {
        side: OrderSide.SELL,
        size: '2',
        sizeInCounter: false,
      });

      const fills = exchange.processCandle(
        createCandle({close: '95', open: '98', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      expect(fills[0].price).toBe('98');
      expect(fills[0].side).toBe(OrderSide.SELL);
    });
  });

  describe('limit orders', () => {
    it('fills limit buy when candle low reaches the limit price', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      await exchange.placeLimitOrder(pair, {
        price: '95',
        side: OrderSide.BUY,
        size: '1',
      });

      // Next candle: open=98, low=93 — limit price 95 is reachable
      const fills = exchange.processCandle(
        createCandle({close: '96', high: '99', low: '93', open: '98', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      // Fill at limit price since open (98) > limit (95)
      expect(fills[0].price).toBe('95');
    });

    it('stays pending when limit buy price is not reached', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      await exchange.placeLimitOrder(pair, {
        price: '90',
        side: OrderSide.BUY,
        size: '1',
      });

      // Next candle: low=92, doesn't reach limit price of 90
      const fills = exchange.processCandle(
        createCandle({close: '96', high: '99', low: '92', open: '98', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(0);
      expect(exchange.getPendingOrders()).toHaveLength(1);
    });

    it('gives price improvement when candle opens below limit buy price', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({close: '500', open: '500'}));

      await exchange.placeLimitOrder(pair, {
        price: '500',
        side: OrderSide.BUY,
        size: '1',
      });

      // Next candle opens at 360, well below limit of 500 → price improvement
      const fills = exchange.processCandle(
        createCandle({close: '380', high: '400', low: '350', open: '360', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      expect(fills[0].price).toBe('360');
    });

    it('fills limit sell when candle high reaches the limit price', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      await exchange.placeLimitOrder(pair, {
        price: '105',
        side: OrderSide.SELL,
        size: '2',
      });

      // Next candle: open=102, high=108 — limit price 105 is reachable
      const fills = exchange.processCandle(
        createCandle({close: '106', high: '108', low: '101', open: '102', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      // Fill at limit price since open (102) < limit (105)
      expect(fills[0].price).toBe('105');
    });

    it('gives price improvement when candle opens above limit sell price', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      await exchange.placeLimitOrder(pair, {
        price: '400',
        side: OrderSide.SELL,
        size: '2',
      });

      // Next candle opens at 450, above limit of 400 → price improvement
      const fills = exchange.processCandle(
        createCandle({close: '430', high: '460', low: '420', open: '450', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      expect(fills[0].price).toBe('450');
    });
  });

  describe('balance tracking', () => {
    it('puts counter on hold when placing a buy order', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      await exchange.placeLimitOrder(pair, {
        price: '100',
        side: OrderSide.BUY,
        size: '1',
      });

      const balances = await exchange.listBalances();
      const usdBalance = balances.find(b => b.currency === 'USD')!;
      // 1 * 100 = 100, plus fee estimate
      expect(parseFloat(usdBalance.available)).toBeLessThan(10000);
      expect(parseFloat(usdBalance.hold)).toBeGreaterThan(0);
    });

    it('puts base on hold when placing a sell order', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      await exchange.placeLimitOrder(pair, {
        price: '100',
        side: OrderSide.SELL,
        size: '2',
      });

      const balances = await exchange.listBalances();
      const btcBalance = balances.find(b => b.currency === 'BTC')!;
      expect(btcBalance.available).toBe('3');
      expect(btcBalance.hold).toBe('2');
    });

    it('releases hold on cancel', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      const order = await exchange.placeLimitOrder(pair, {
        price: '100',
        side: OrderSide.SELL,
        size: '2',
      });

      await exchange.cancelOrderById(pair, order.id);

      const balances = await exchange.listBalances();
      const btcBalance = balances.find(b => b.currency === 'BTC')!;
      expect(btcBalance.available).toBe('5');
      expect(btcBalance.hold).toBe('0');
    });

    it('rejects orders with insufficient balance', async () => {
      const exchange = createExchange('0', '50');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      // Trying to buy 1 BTC at $100 = $100 needed, but only $50 available
      await expect(
        exchange.placeLimitOrder(pair, {
          price: '100',
          side: OrderSide.BUY,
          size: '1',
        })
      ).rejects.toThrow('Insufficient');
    });
  });

  describe('fee deduction', () => {
    it('deducts fees on fill', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      await exchange.placeLimitOrder(pair, {
        price: '100',
        side: OrderSide.SELL,
        size: '1',
      });

      const fills = exchange.processCandle(
        createCandle({close: '100', high: '100', low: '100', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      // Fee: 1 * 100 * 0.0015 = 0.15
      expect(fills[0].fee).toBe('0.15');

      // Counter balance: revenue (100) - fee (0.15) = 99.85
      const balances = await exchange.listBalances();
      const usdBalance = balances.find(b => b.currency === 'USD')!;
      expect(usdBalance.available).toBe('99.85');
    });
  });

  describe('1-candle delay', () => {
    it('does not fill orders on the same candle they are placed', async () => {
      const exchange = createExchange('5', '0');

      // Process initial candle
      const candle1 = createCandle({close: '100', high: '110', low: '90', open: '100'});
      exchange.processCandle(candle1);

      // Place sell order — the current candle range would match, but it shouldn't
      await exchange.placeLimitOrder(pair, {
        price: '100',
        side: OrderSide.SELL,
        size: '1',
      });

      /*
       * The order was placed after processCandle, so it wasn't included in matching
       * Verify the order is still pending
       */
      expect(exchange.getPendingOrders()).toHaveLength(1);

      // Only fills on the NEXT candle
      const fills = exchange.processCandle(
        createCandle({close: '100', high: '100', low: '100', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
    });
  });

  describe('watchOrders', () => {
    it('returns a unique topicId per subscription', async () => {
      const exchange = createExchange('0', '0');

      const first = await exchange.watchOrders();
      const second = await exchange.watchOrders();

      expect(first).not.toBe(second);
    });

    it('emits fills to subscribers on the returned topic', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      const topicId = await exchange.watchOrders();
      const received: Fill[] = [];
      exchange.on(topicId, (fill: Fill) => received.push(fill));

      await exchange.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});

      const fills = exchange.processCandle(
        createCandle({close: '110', open: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(received, 'subscriber receives exactly the fills returned by processCandle').toEqual(fills);
      expect(received[0].side).toBe(OrderSide.BUY);
    });

    it('stops emitting after unwatchOrders()', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      const topicId = await exchange.watchOrders();
      const received: Fill[] = [];
      exchange.on(topicId, (fill: Fill) => received.push(fill));
      exchange.unwatchOrders(topicId);

      await exchange.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});
      exchange.processCandle(createCandle({close: '110', open: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'}));

      expect(received).toHaveLength(0);
    });
  });

  describe('lifecycle', () => {
    it('disconnect() removes order subscriptions', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({close: '100', open: '100'}));

      const topicId = await exchange.watchOrders();
      const received: Fill[] = [];
      exchange.on(topicId, (fill: Fill) => received.push(fill));

      exchange.disconnect();

      await exchange.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});
      exchange.processCandle(createCandle({close: '110', open: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'}));

      expect(received, 'disconnect() should stop fill emissions').toHaveLength(0);
    });
  });
});
