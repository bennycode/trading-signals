import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {ExchangeMock, type ExchangeMockBalance} from './ExchangeMock.js';
import {
  type ExchangeCandle,
  type ExchangeFeeRate,
  ExchangeOrderSide,
  ExchangeOrderType,
  type ExchangeTradingRules,
} from './Exchange.js';
import {TradingPair} from './TradingPair.js';

class TestExchangeMock extends ExchangeMock {
  static readonly TEST_FEE_RATES: ExchangeFeeRate = {
    [ExchangeOrderType.MARKET]: new Big(0.0025),
    [ExchangeOrderType.LIMIT]: new Big(0.0015),
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

  async getFeeRates(): Promise<ExchangeFeeRate> {
    return TestExchangeMock.TEST_FEE_RATES;
  }

  async getTradingRules(pair: TradingPair): Promise<ExchangeTradingRules> {
    return {...TestExchangeMock.TEST_TRADING_RULES, pair};
  }

  getName(): string {
    return 'TestExchange';
  }

  getSmallestInterval(): number {
    return 60000;
  }

}

const pair = new TradingPair('BTC', 'USD');

function createCandle(overrides: Partial<ExchangeCandle> & {open: string; close: string}): ExchangeCandle {
  const openNum = parseFloat(overrides.open);
  const closeNum = parseFloat(overrides.close);
  return {
    base: 'BTC',
    counter: 'USD',
    high: overrides.high ?? String(Math.max(openNum, closeNum)),
    low: overrides.low ?? String(Math.min(openNum, closeNum)),
    open: overrides.open,
    close: overrides.close,
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

describe('ExchangeMock', () => {
  describe('market orders', () => {
    it('fills market buy order at the next candle open price', async () => {
      const exchange = createExchange('0', '10000');

      // Process first candle to set current state
      exchange.processCandle(createCandle({open: '100', close: '100'}));

      // Place market buy order
      await exchange.placeMarketOrder(pair, {
        side: ExchangeOrderSide.BUY,
        size: '1',
        sizeInCounter: false,
      });

      // Process next candle — order should fill at this candle's open
      const fills = exchange.processCandle(
        createCandle({open: '105', close: '110', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      expect(fills[0].price).toBe('105');
      expect(fills[0].side).toBe(ExchangeOrderSide.BUY);
    });

    it('fills market sell order at the next candle open price', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({open: '100', close: '100'}));

      await exchange.placeMarketOrder(pair, {
        side: ExchangeOrderSide.SELL,
        size: '2',
        sizeInCounter: false,
      });

      const fills = exchange.processCandle(
        createCandle({open: '98', close: '95', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      expect(fills[0].price).toBe('98');
      expect(fills[0].side).toBe(ExchangeOrderSide.SELL);
    });
  });

  describe('limit orders', () => {
    it('fills limit buy when candle low reaches the limit price', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({open: '100', close: '100'}));

      await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.BUY,
        size: '1',
        price: '95',
      });

      // Next candle: open=98, low=93 — limit price 95 is reachable
      const fills = exchange.processCandle(
        createCandle({open: '98', close: '96', low: '93', high: '99', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      // Fill at limit price since open (98) > limit (95)
      expect(fills[0].price).toBe('95');
    });

    it('stays pending when limit buy price is not reached', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({open: '100', close: '100'}));

      await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.BUY,
        size: '1',
        price: '90',
      });

      // Next candle: low=92, doesn't reach limit price of 90
      const fills = exchange.processCandle(
        createCandle({open: '98', close: '96', low: '92', high: '99', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(0);
      expect(exchange.getPendingOrders()).toHaveLength(1);
    });

    it('gives price improvement when candle opens below limit buy price', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({open: '500', close: '500'}));

      await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.BUY,
        size: '1',
        price: '500',
      });

      // Next candle opens at 360, well below limit of 500 → price improvement
      const fills = exchange.processCandle(
        createCandle({open: '360', close: '380', low: '350', high: '400', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      expect(fills[0].price).toBe('360');
    });

    it('fills limit sell when candle high reaches the limit price', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({open: '100', close: '100'}));

      await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.SELL,
        size: '2',
        price: '105',
      });

      // Next candle: open=102, high=108 — limit price 105 is reachable
      const fills = exchange.processCandle(
        createCandle({open: '102', close: '106', low: '101', high: '108', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      // Fill at limit price since open (102) < limit (105)
      expect(fills[0].price).toBe('105');
    });

    it('gives price improvement when candle opens above limit sell price', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({open: '100', close: '100'}));

      await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.SELL,
        size: '2',
        price: '400',
      });

      // Next candle opens at 450, above limit of 400 → price improvement
      const fills = exchange.processCandle(
        createCandle({open: '450', close: '430', low: '420', high: '460', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
      expect(fills[0].price).toBe('450');
    });
  });

  describe('balance tracking', () => {
    it('puts counter on hold when placing a buy order', async () => {
      const exchange = createExchange('0', '10000');

      exchange.processCandle(createCandle({open: '100', close: '100'}));

      await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.BUY,
        size: '1',
        price: '100',
      });

      const balances = await exchange.listBalances();
      const usdBalance = balances.find(b => b.currency === 'USD')!;
      // 1 * 100 = 100, plus fee estimate
      expect(parseFloat(usdBalance.available)).toBeLessThan(10000);
      expect(parseFloat(usdBalance.hold)).toBeGreaterThan(0);
    });

    it('puts base on hold when placing a sell order', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({open: '100', close: '100'}));

      await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.SELL,
        size: '2',
        price: '100',
      });

      const balances = await exchange.listBalances();
      const btcBalance = balances.find(b => b.currency === 'BTC')!;
      expect(btcBalance.available).toBe('3');
      expect(btcBalance.hold).toBe('2');
    });

    it('releases hold on cancel', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({open: '100', close: '100'}));

      const order = await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.SELL,
        size: '2',
        price: '100',
      });

      await exchange.cancelOrderById(pair, order.id);

      const balances = await exchange.listBalances();
      const btcBalance = balances.find(b => b.currency === 'BTC')!;
      expect(btcBalance.available).toBe('5');
      expect(btcBalance.hold).toBe('0');
    });

    it('rejects orders with insufficient balance', async () => {
      const exchange = createExchange('0', '50');

      exchange.processCandle(createCandle({open: '100', close: '100'}));

      // Trying to buy 1 BTC at $100 = $100 needed, but only $50 available
      await expect(
        exchange.placeLimitOrder(pair, {
          side: ExchangeOrderSide.BUY,
          size: '1',
          price: '100',
        })
      ).rejects.toThrow('Insufficient');
    });
  });

  describe('fee deduction', () => {
    it('deducts fees on fill', async () => {
      const exchange = createExchange('5', '0');

      exchange.processCandle(createCandle({open: '100', close: '100'}));

      await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.SELL,
        size: '1',
        price: '100',
      });

      const fills = exchange.processCandle(
        createCandle({open: '100', close: '100', low: '100', high: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'})
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
      const candle1 = createCandle({open: '100', close: '100', low: '90', high: '110'});
      exchange.processCandle(candle1);

      // Place sell order — the current candle range would match, but it shouldn't
      await exchange.placeLimitOrder(pair, {
        side: ExchangeOrderSide.SELL,
        size: '1',
        price: '100',
      });

      // The order was placed after processCandle, so it wasn't included in matching
      // Verify the order is still pending
      expect(exchange.getPendingOrders()).toHaveLength(1);

      // Only fills on the NEXT candle
      const fills = exchange.processCandle(
        createCandle({open: '100', close: '100', low: '100', high: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'})
      );

      expect(fills).toHaveLength(1);
    });
  });

  describe('unsupported methods', () => {
    it('throws on getCandles()', async () => {
      const exchange = createExchange('0', '0');
      await expect(
        exchange.getCandles(pair, {
          intervalInMillis: 60000,
          startTimeFirstCandle: '',
          startTimeLastCandle: '',
        })
      ).rejects.toThrow('not supported');
    });

    it('throws on watchCandles()', async () => {
      const exchange = createExchange('0', '0');
      await expect(exchange.watchCandles(pair, 60000, '')).rejects.toThrow('not supported');
    });

    it('throws on unwatchCandles()', () => {
      const exchange = createExchange('0', '0');
      expect(() => exchange.unwatchCandles('test')).toThrow('not supported');
    });

    it('disconnect() is a no-op', () => {
      const exchange = createExchange('0', '0');
      expect(() => exchange.disconnect()).not.toThrow();
    });
  });
});
