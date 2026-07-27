import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaBrokerMock, OrderSide, OrderType} from '@typedtrader/exchange';
import {AllAvailableAmount} from '../trader/index.js';
import type {Candle, TradingRules} from '@typedtrader/exchange';
import type {OrderAdvice, TradingSessionState} from '../trader/index.js';
import {TradingPair} from '@typedtrader/exchange';
import {BacktestExecutor} from './BacktestExecutor.js';
import {BuyBelowSellAboveStrategy} from '../strategy-buy-below-sell-above/BuyBelowSellAboveStrategy.js';
import type {BacktestConfig} from './BacktestConfig.js';
import {Strategy} from '../strategy/Strategy.js';
import type {OneMinuteBatchedCandle} from '@typedtrader/exchange';

function createCandle(overrides: Partial<Candle> & {close: string; open: string}): Candle {
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

function createMockExchange(options: {baseBalance?: string; counterBalance?: string} = {}) {
  const balances = new Map([
    ['BTC', {available: new Big(options.baseBalance ?? '0'), hold: new Big(0)}],
    ['USD', {available: new Big(options.counterBalance ?? '1000'), hold: new Big(0)}],
  ]);
  return new AlpacaBrokerMock({balances});
}

describe('BacktestExecutor', () => {
  const tradingPair = new TradingPair('BTC', 'USD');

  describe('execute', () => {
    it('returns initial balances unchanged when strategy gives no advice', async () => {
      class NoOpStrategy extends Strategy {
        static override NAME = 'NoOp';

        protected override async processCandle(
          _candle: OneMinuteBatchedCandle,
          _state: TradingSessionState
        ): Promise<OrderAdvice | void> {
          return undefined;
        }
      }

      const candles = [createCandle({close: '105', open: '100'}), createCandle({close: '110', open: '105'})] as const;

      const config: BacktestConfig = {
        broker: createMockExchange({baseBalance: '1', counterBalance: '1000'}),
        candles: [...candles],
        strategy: new NoOpStrategy(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(0);
      expect(result.finalBaseBalance.toFixed(2)).toBe('1.00');
      expect(result.finalCounterBalance.toFixed(2)).toBe('1000.00');
      expect(result.totalFees.toFixed(2)).toBe('0.00');
      expect(result.totalCandles).toBe(2);
    });

    it('handles no candles gracefully', async () => {
      const strategy = new BuyBelowSellAboveStrategy({buyBelow: '50'});

      const config: BacktestConfig = {
        broker: createMockExchange(),
        candles: [],
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(0);
      expect(result.totalCandles).toBe(0);
      expect(result.profitOrLoss.toFixed(2)).toBe('0.00');
    });

    it('executes a buy with 1-candle delay when price drops below the buyBelow threshold', async () => {
      const strategy = new BuyBelowSellAboveStrategy({buyBelow: '100'});

      /*
       * Candle 1: close=90 < 100 → advice to BUY_LIMIT, order placed
       * Candle 2: order fills at candle 2 (1-candle delay)
       */
      const candles = [
        createCandle({close: '90', high: '95', low: '88', open: '95', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '95', high: '95', low: '88', open: '92', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange(),
        candles,
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      // Order placed on candle 1, fills on candle 2
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].advice.side).toBe(OrderSide.BUY);
      expect(result.trades[0].advice.type).toBe(OrderType.LIMIT);
      expect(result.finalCounterBalance.lt(new Big(1000))).toBe(true);
      expect(result.finalBaseBalance.gt(new Big(0))).toBe(true);
    });

    it('executes a sell with 1-candle delay when price rises above the sellAbove threshold', async () => {
      const strategy = new BuyBelowSellAboveStrategy({sellAbove: '100'});

      /*
       * Candle 1: close=110 > 100 → advice to SELL_LIMIT, order placed
       * Candle 2: order fills at candle 2
       */
      const candles = [
        createCandle({close: '110', high: '115', low: '105', open: '105', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '112', high: '115', low: '106', open: '108', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange({baseBalance: '2', counterBalance: '0'}),
        candles,
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].advice.side).toBe(OrderSide.SELL);
      expect(result.trades[0].advice.type).toBe(OrderType.LIMIT);
      expect(result.finalBaseBalance.toFixed(2)).toBe('0.00');
      expect(result.finalCounterBalance.gt(new Big(0))).toBe(true);
    });

    it('deducts maker fees on limit orders', async () => {
      const strategy = new BuyBelowSellAboveStrategy({sellAbove: '50'});

      /*
       * Candle 1: close=100 > 50 → SELL_LIMIT advice
       * Candle 2: order fills
       */
      const candles = [
        createCandle({close: '100', high: '100', low: '100', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '100', high: '100', low: '100', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange({baseBalance: '10', counterBalance: '0'}),
        candles,
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);

      /*
       * Selling 10 BTC at 100 USD = 1000 USD revenue
       * Limit fee: 0.15% of 1000 = 1.50
       */
      const trade = result.trades[0];
      expect(trade.fee.toFixed(2)).toBe('1.50');
      expect(result.totalFees.toFixed(2)).toBe('1.50');
    });

    it('deducts taker fees on market orders', async () => {
      class AlwaysBuyMarket extends Strategy {
        static override NAME = 'AlwaysBuyMarket';
        #bought = false;

        protected override async processCandle(
          _candle: OneMinuteBatchedCandle,
          _state: TradingSessionState
        ): Promise<OrderAdvice | void> {
          if (this.#bought) {
            return undefined;
          }

          this.#bought = true;

          return {
            amount: AllAvailableAmount,
            amountIn: 'counter',
            side: OrderSide.BUY,
            type: OrderType.MARKET,
          };
        }
      }

      /*
       * Candle 1: strategy says buy market
       * Candle 2: market order fills at candle 2's open price
       */
      const candles = [
        createCandle({close: '50', high: '50', low: '50', open: '50', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '50', high: '50', low: '50', open: '50', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange(),
        candles,
        strategy: new AlwaysBuyMarket(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      // Market order fee: 0.25%
      expect(trade.fee.gt(0)).toBe(true);
      expect(result.finalBaseBalance.gt(new Big(0))).toBe(true);
    });

    it('runs a full buy-and-sell cycle and computes profit/loss', async () => {
      const strategy = new BuyBelowSellAboveStrategy({
        buyBelow: '100',
        sellAbove: '120',
      });

      /*
       * Need extra candles to account for 1-candle delay:
       * Candle 1: close=80 → BUY advice
       * Candle 2: buy fills, close=85 → BUY advice again
       * Candle 3: buy fills, close=115 → no trigger
       * Candle 4: close=130 → SELL advice
       * Candle 5: sell fills
       */
      const candles = [
        createCandle({close: '80', high: '82', low: '78', open: '80', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '85', high: '90', low: '78', open: '82', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
        createCandle({close: '115', high: '118', low: '108', open: '110', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
        createCandle({close: '130', high: '135', low: '118', open: '120', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
        createCandle({close: '132', high: '135', low: '125', open: '128', openTimeInISO: '2025-01-01T00:04:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange(),
        candles,
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      // Should have at least a buy and a sell
      expect(result.trades.length).toBeGreaterThanOrEqual(2);

      // Overall, bought low and sold high, so we expect profit
      expect(result.profitOrLoss.gt(0)).toBe(true);
      expect(result.totalFees.gt(0)).toBe(true);
    });

    it('skips trades when there is insufficient balance', async () => {
      const strategy = new BuyBelowSellAboveStrategy({sellAbove: '50'});

      const candles = [
        createCandle({close: '100', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '100', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange({baseBalance: '0', counterBalance: '1000'}),
        candles,
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      // Strategy advises sell, but base balance is 0
      expect(result.trades).toHaveLength(0);
      expect(result.finalBaseBalance.toFixed(2)).toBe('0.00');
      expect(result.finalCounterBalance.toFixed(2)).toBe('1000.00');

      // Dropped advice is reported, not silently swallowed — one skip per advising candle
      expect(result.skippedAdvices).toHaveLength(2);
      expect(result.skippedAdvices[0].reason).toContain('below minimum');
      expect(result.skippedAdvices[0].advice.side).toBe(OrderSide.SELL);
    });

    it('cancels an outstanding order when newer advice arrives, mirroring a live session', async () => {
      class RepriceBuy extends Strategy {
        static override NAME = 'RepriceBuy';
        #candleCount = 0;

        protected override async processCandle(
          _candle: OneMinuteBatchedCandle,
          _state: TradingSessionState
        ): Promise<OrderAdvice | void> {
          this.#candleCount += 1;

          if (this.#candleCount === 1) {
            // Would fill on candle 3 (low=88) if it survived
            return {amount: '1', amountIn: 'base', price: '90', side: OrderSide.BUY, type: OrderType.LIMIT};
          }

          if (this.#candleCount === 2) {
            // Replaces the first order with one that can never fill
            return {amount: '1', amountIn: 'base', price: '50', side: OrderSide.BUY, type: OrderType.LIMIT};
          }
        }
      }

      const candles = [
        createCandle({close: '100', high: '100', low: '100', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '100', high: '100', low: '100', open: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
        createCandle({close: '95', high: '100', low: '88', open: '100', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange(),
        candles,
        strategy: new RepriceBuy(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      /*
       * A live TradingSession cancels outstanding orders before acting on new advice. Without
       * that, the buy@90 from candle 1 would survive and fill on candle 3 (low=88) — a trade
       * a live session would never make.
       */
      expect(result.trades).toHaveLength(0);
      expect(result.finalCounterBalance.toFixed(2)).toBe('1000.00');
    });

    it('tracks the total number of candles processed', async () => {
      const strategy = new BuyBelowSellAboveStrategy({buyBelow: '1000'});

      const candles = [
        createCandle({close: '50', high: '52', low: '48', open: '50', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '55', high: '58', low: '48', open: '55', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
        createCandle({close: '60', high: '62', low: '58', open: '60', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
        createCandle({close: '65', high: '67', low: '63', open: '65', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
        createCandle({close: '70', high: '72', low: '68', open: '70', openTimeInISO: '2025-01-01T00:04:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange({counterBalance: '500'}),
        candles,
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.totalCandles).toBe(5);
    });

    it('caps sell size to available base balance', async () => {
      class SellTooMuch extends Strategy {
        static override NAME = 'SellTooMuch';
        #sold = false;

        protected override async processCandle(
          candle: OneMinuteBatchedCandle,
          _state: TradingSessionState
        ): Promise<OrderAdvice | void> {
          if (this.#sold) {
            return undefined;
          }
          this.#sold = true;
          return {
            amount: new Big(100),
            amountIn: 'base',
            price: candle.close,
            side: OrderSide.SELL,
            type: OrderType.LIMIT,
          };
        }
      }

      /*
       * Candle 1: strategy says sell 100, order placed (capped to 5)
       * Candle 2: order fills
       */
      const candles = [
        createCandle({close: '50', high: '50', low: '50', open: '50', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '50', high: '50', low: '50', open: '50', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange({baseBalance: '5', counterBalance: '0'}),
        candles,
        strategy: new SellTooMuch(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);
      // Capped to 5 (the available balance), not 100
      expect(result.trades[0].size.toFixed(2)).toBe('5.00');
      expect(result.finalBaseBalance.toFixed(2)).toBe('0.00');
    });

    it('handles many buy-sell cycles over a long series of candles', async () => {
      // Strategy: buy below 50, sell above 60 → oscillating price triggers multiple cycles
      const strategy = new BuyBelowSellAboveStrategy({
        buyBelow: '50',
        sellAbove: '60',
      });

      // Simulate price oscillations — with 1-candle delay, orders fill on next candle
      const candles: Candle[] = [];
      const startTime = new Date('2025-01-06T00:00:00.000Z');
      const prices = [
        '45',
        '48',
        '55',
        '62',
        '65',
        '58',
        '52',
        '44',
        '42',
        '50',
        '55',
        '63',
        '68',
        '60',
        '53',
        '47',
        '43',
        '49',
        '56',
        '64',
        '70',
        '59',
        '51',
        '46',
        '40',
        '48',
        '57',
        '66',
        '72',
        '61',
        '54',
        '47',
        '43',
        '50',
        '58',
        '65',
        '71',
        '60',
        '52',
        '45',
        '41',
        '49',
        '56',
        '63',
        '69',
        '58',
        '50',
        '44',
        '42',
        '48',
        '55',
        '62',
      ] as const;

      prices.forEach((price, i) => {
        const time = new Date(startTime.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const priceNum = parseFloat(price);

        candles.push(
          createCandle({
            close: price,
            high: String(priceNum + 2),
            low: String(priceNum - 2),
            open: price,
            openTimeInISO: time.toISOString(),
            openTimeInMillis: time.getTime(),
            sizeInMillis: 7 * 24 * 60 * 60 * 1000,
          })
        );
      });

      const config: BacktestConfig = {
        broker: createMockExchange({counterBalance: '10000'}),
        candles,
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();
      const {performance} = result;

      // Verify multiple trades happened
      expect(performance.totalTrades).toBeGreaterThan(5);

      // Verify we tracked all candles
      expect(result.totalCandles).toBe(52);

      // Verify fees were collected
      expect(result.totalFees.gt(0)).toBe(true);

      // Every trade should have a positive fee
      result.trades.forEach(trade => {
        expect(trade.fee.gt(0)).toBe(true);
      });
    });

    it('reports a positive win rate when buying low and selling high', async () => {
      const strategy = new BuyBelowSellAboveStrategy({
        buyBelow: '50',
        sellAbove: '80',
      });

      // With 1-candle delay, we need pairs of candles for each trade to fill
      const candles = [
        createCandle({close: '40', high: '42', low: '38', open: '40', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '45', high: '48', low: '38', open: '42', openTimeInISO: '2025-01-15T00:00:00.000Z'}),
        createCandle({close: '90', high: '95', low: '88', open: '90', openTimeInISO: '2025-02-01T00:00:00.000Z'}),
        createCandle({close: '85', high: '92', low: '82', open: '88', openTimeInISO: '2025-02-15T00:00:00.000Z'}),
        createCandle({close: '35', high: '38', low: '33', open: '35', openTimeInISO: '2025-03-01T00:00:00.000Z'}),
        createCandle({close: '40', high: '42', low: '33', open: '37', openTimeInISO: '2025-03-15T00:00:00.000Z'}),
        createCandle({close: '85', high: '90', low: '83', open: '85', openTimeInISO: '2025-04-01T00:00:00.000Z'}),
        createCandle({close: '80', high: '88', low: '78', open: '83', openTimeInISO: '2025-04-15T00:00:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange(),
        candles,
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();
      const {performance} = result;

      // Should have buy-sell cycles, both profitable
      expect(performance.totalTrades).toBeGreaterThanOrEqual(2);
      expect(performance.winRate.gt(0)).toBe(true);
      expect(result.profitOrLoss.gt(0)).toBe(true);
    });

    it('reports return percentage and portfolio values correctly', async () => {
      class BuyOnce extends Strategy {
        static override NAME = 'BuyOnce';
        #bought = false;

        protected override async processCandle(
          _candle: OneMinuteBatchedCandle,
          _state: TradingSessionState
        ): Promise<OrderAdvice | void> {
          if (this.#bought) {
            return undefined;
          }

          this.#bought = true;

          return {
            amount: AllAvailableAmount,
            amountIn: 'counter',
            side: OrderSide.BUY,
            type: OrderType.MARKET,
          };
        }
      }

      /*
       * Candle 1: strategy says buy, order placed
       * Candle 2: market order fills at open=100, then price goes to 150
       */
      const candles = [
        createCandle({close: '100', high: '100', low: '100', open: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '150', high: '150', low: '100', open: '100', openTimeInISO: '2025-06-01T00:00:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockExchange(),
        candles,
        strategy: new BuyOnce(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();
      const {performance} = result;

      expect(performance.totalTrades).toBe(1);

      // Initial portfolio: 0 base * 100 (first open) + 1000 counter = 1000
      expect(performance.initialPortfolioValue.toFixed(2)).toBe('1000.00');

      // Bought BTC at 100, now worth more at 150
      expect(performance.finalPortfolioValue.gt(new Big(1400))).toBe(true);
      expect(performance.returnPercentage.gt(new Big(40))).toBe(true);
    });

    it('uses first candle open (not last close) for initial portfolio valuation when base balance > 0', async () => {
      class NoOpStrategy extends Strategy {
        static override NAME = 'NoOp';

        protected override async processCandle(
          _candle: OneMinuteBatchedCandle,
          _state: TradingSessionState
        ): Promise<OrderAdvice | void> {
          return undefined;
        }
      }

      // firstOpen=50, lastClose=200 — they differ so the test distinguishes which is used
      const candles = [
        createCandle({close: '80', high: '82', low: '48', open: '50', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '200', high: '205', low: '115', open: '120', openTimeInISO: '2025-01-02T00:00:00.000Z'}),
      ];

      const config: BacktestConfig = {
        // 2 BTC initial base balance so the open price matters for valuation
        broker: createMockExchange({baseBalance: '2', counterBalance: '0'}),
        candles,
        strategy: new NoOpStrategy(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();
      const {performance} = result;

      // initialPortfolioValue = 2 BTC * firstOpen(50) + 0 counter = 100
      expect(performance.initialPortfolioValue.toFixed(2)).toBe('100.00');

      // If lastClose(200) were used it would be 400, so this assertion distinguishes the two
      expect(performance.initialPortfolioValue.toFixed(2)).not.toBe('400.00');
    });

    it('provides a complete performance summary for zero-trade runs', async () => {
      class NoOpStrategy extends Strategy {
        static override NAME = 'NoOp';

        protected override async processCandle(
          _candle: OneMinuteBatchedCandle,
          _state: TradingSessionState
        ): Promise<OrderAdvice | void> {
          return undefined;
        }
      }

      const candles = [createCandle({close: '100', open: '100'})];

      const config: BacktestConfig = {
        broker: createMockExchange(),
        candles,
        strategy: new NoOpStrategy(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();
      const {performance} = result;

      expect(performance.totalTrades).toBe(0);
      expect(performance.winRate.toFixed(2)).toBe('0.00');
      expect(performance.returnPercentage.toFixed(2)).toBe('0.00');
      expect(performance.buyAndHoldReturnPercentage).toBeDefined();
      expect(performance.maxWinStreak).toBe(0);
      expect(performance.maxLossStreak).toBe(0);
    });
  });

  describe('tradingRules', () => {
    const STRICT_TRADING_RULES: Omit<TradingRules, 'pair'> = {
      base_increment: '0.0001',
      base_max_size: '100',
      base_min_size: '0.0001',
      counter_increment: '0.01',
      counter_min_size: '1',
    };

    function createMockWithRules(options: {baseBalance?: string; counterBalance?: string} = {}) {
      const balances = new Map([
        ['BTC', {available: new Big(options.baseBalance ?? '0'), hold: new Big(0)}],
        ['USD', {available: new Big(options.counterBalance ?? '1000'), hold: new Big(0)}],
      ]);
      return new AlpacaBrokerMock({balances, tradingRules: STRICT_TRADING_RULES});
    }

    it('skips buy trades when the computed size is below base_min_size', async () => {
      class AlwaysBuyMarket extends Strategy {
        static override NAME = 'AlwaysBuyMarket';

        protected override async processCandle(
          _candle: OneMinuteBatchedCandle,
          _state: TradingSessionState
        ): Promise<OrderAdvice | void> {
          return {
            amount: AllAvailableAmount,
            amountIn: 'counter',
            side: OrderSide.BUY,
            type: OrderType.MARKET,
          };
        }
      }

      // Two candles: advice on candle 1, would fill on candle 2
      const candles = [
        createCandle({
          close: '50000',
          high: '50000',
          low: '50000',
          open: '50000',
          openTimeInISO: '2025-01-01T00:00:00.000Z',
        }),
        createCandle({
          close: '50000',
          high: '50000',
          low: '50000',
          open: '50000',
          openTimeInISO: '2025-01-01T00:01:00.000Z',
        }),
      ];

      const config: BacktestConfig = {
        // Only $1 at price $50,000 can buy 0.00002 BTC, below min 0.0001
        broker: createMockWithRules({counterBalance: '1'}),
        candles,
        strategy: new AlwaysBuyMarket(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(0);
      expect(result.skippedAdvices).toHaveLength(2);
      expect(result.skippedAdvices[0].reason).toContain('below the minimum');
    });

    it('skips sell trades when the base balance is below base_min_size', async () => {
      class AlwaysSellMarket extends Strategy {
        static override NAME = 'AlwaysSellMarket';

        protected override async processCandle(
          _candle: OneMinuteBatchedCandle,
          _state: TradingSessionState
        ): Promise<OrderAdvice | void> {
          return {
            amount: AllAvailableAmount,
            amountIn: 'base',
            side: OrderSide.SELL,
            type: OrderType.MARKET,
          };
        }
      }

      const candles = [
        createCandle({
          close: '50000',
          high: '50000',
          low: '50000',
          open: '50000',
          openTimeInISO: '2025-01-01T00:00:00.000Z',
        }),
        createCandle({
          close: '50000',
          high: '50000',
          low: '50000',
          open: '50000',
          openTimeInISO: '2025-01-01T00:01:00.000Z',
        }),
      ];

      const config: BacktestConfig = {
        broker: createMockWithRules({baseBalance: '0.00005'}),
        candles,
        strategy: new AlwaysSellMarket(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(0);
    });

    it('allows trades that meet all trading rule requirements', async () => {
      const strategy = new BuyBelowSellAboveStrategy({
        buyBelow: '100',
        sellAbove: '120',
      });

      // With 1-candle delay: buy advice on c1, fills c2, sell advice on c3, fills c4
      const candles = [
        createCandle({close: '80', high: '82', low: '78', open: '80', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({close: '85', high: '90', low: '78', open: '82', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
        createCandle({close: '130', high: '135', low: '128', open: '130', openTimeInISO: '2025-01-02T00:00:00.000Z'}),
        createCandle({close: '132', high: '135', low: '125', open: '128', openTimeInISO: '2025-01-02T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        broker: createMockWithRules(),
        candles,
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      // Buy at ~80, sell at ~130 — both should pass trading rules
      expect(result.trades).toHaveLength(2);
      expect(result.profitOrLoss.gt(0)).toBe(true);
    });

    it('does not fill a limit order when the rounded price falls outside the candle range', async () => {
      /*
       * counter_increment = 0.50, so a price of 100.10 rounds down to 100.00.
       * The candle's low is 100.10, so the rounded order price (100.00) is below the low
       * and the order must NOT fill.
       */
      const COARSE_RULES: Omit<TradingRules, 'pair'> = {
        base_increment: '0.0001',
        base_max_size: '100',
        base_min_size: '0.0001',
        counter_increment: '0.50',
        counter_min_size: '1',
      };

      class BuyAtPrice extends Strategy {
        static override NAME = 'BuyAtPrice';
        #advised = false;

        protected override async processCandle(
          candle: OneMinuteBatchedCandle,
          _state: TradingSessionState
        ): Promise<OrderAdvice | void> {
          if (this.#advised) {
            return undefined;
          }
          this.#advised = true;
          return {
            amount: AllAvailableAmount,
            amountIn: 'base',
            price: candle.close,
            side: OrderSide.BUY,
            type: OrderType.LIMIT,
          };
        }
      }

      const balances = new Map([
        ['BTC', {available: new Big(0), hold: new Big(0)}],
        ['USD', {available: new Big(1000), hold: new Big(0)}],
      ]);
      const exchange = new AlpacaBrokerMock({balances, tradingRules: COARSE_RULES});

      /*
       * Candle 1: close=100.10 → advice to BUY_LIMIT at 100.10, which rounds to 100.00
       * Candle 2: low=100.10 → rounded price (100.00) < low (100.10), so order must NOT fill
       */
      const candles = [
        createCandle({
          close: '100.10',
          high: '105.00',
          low: '100.10',
          open: '100.10',
          openTimeInISO: '2025-01-01T00:00:00.000Z',
        }),
        createCandle({
          close: '102.00',
          high: '105.00',
          low: '100.10',
          open: '101.00',
          openTimeInISO: '2025-01-01T00:01:00.000Z',
        }),
      ];

      const config: BacktestConfig = {
        broker: exchange,
        candles,
        strategy: new BuyAtPrice(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      // The rounded price (100.00) is below the candle's low (100.10) — no fill should occur
      expect(result.trades).toHaveLength(0);
    });
  });
});
