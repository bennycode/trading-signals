import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaExchangeMock} from '@typedtrader/exchange';
import type {ExchangeCandle, ExchangeTradingRules} from '@typedtrader/exchange';
import {TradingPair} from '@typedtrader/exchange';
import {BacktestExecutor} from './BacktestExecutor.js';
import {BuyBelowSellAboveStrategy} from '../strategy-buy-below-sell-above/BuyBelowSellAboveStrategy.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import type {BacktestConfig} from './BacktestConfig.js';
import {Strategy} from '../strategy/Strategy.js';
import type {StrategyAdvice} from '../strategy/StrategyAdvice.js';
import type {BatchedCandle} from '@typedtrader/exchange';

function createCandle(overrides: Partial<ExchangeCandle> & {close: string; open: string}): ExchangeCandle {
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

function createMockExchange(options: {baseBalance?: string; counterBalance?: string} = {}) {
  const balances = new Map([
    ['BTC', {available: new Big(options.baseBalance ?? '0'), hold: new Big(0)}],
    ['USD', {available: new Big(options.counterBalance ?? '1000'), hold: new Big(0)}],
  ]);
  return new AlpacaExchangeMock({balances});
}

describe('BacktestExecutor', () => {
  const tradingPair = new TradingPair('BTC', 'USD');

  describe('execute', () => {
    it('returns initial balances unchanged when strategy gives no advice', async () => {
      class NoOpStrategy extends Strategy {
        static override NAME = 'NoOp';

        protected override async processCandle(): Promise<StrategyAdvice | void> {
          return undefined;
        }
      }

      const candles = [createCandle({open: '100', close: '105'}), createCandle({open: '105', close: '110'})] as const;

      const config: BacktestConfig = {
        candles: [...candles],
        exchange: createMockExchange({baseBalance: '1', counterBalance: '1000'}),
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
        candles: [],
        exchange: createMockExchange(),
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

      // Candle 1: close=90 < 100 → advice to BUY_LIMIT, order placed
      // Candle 2: order fills at candle 2 (1-candle delay)
      const candles = [
        createCandle({open: '95', close: '90', low: '88', high: '95', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '92', close: '95', low: '88', high: '95', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange(),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      // Order placed on candle 1, fills on candle 2
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].advice.signal).toBe(StrategySignal.BUY_LIMIT);
      expect(result.finalCounterBalance.lt(new Big(1000))).toBe(true);
      expect(result.finalBaseBalance.gt(new Big(0))).toBe(true);
    });

    it('executes a sell with 1-candle delay when price rises above the sellAbove threshold', async () => {
      const strategy = new BuyBelowSellAboveStrategy({sellAbove: '100'});

      // Candle 1: close=110 > 100 → advice to SELL_LIMIT, order placed
      // Candle 2: order fills at candle 2
      const candles = [
        createCandle({open: '105', close: '110', low: '105', high: '115', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '108', close: '112', low: '106', high: '115', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange({baseBalance: '2', counterBalance: '0'}),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].advice.signal).toBe(StrategySignal.SELL_LIMIT);
      expect(result.finalBaseBalance.toFixed(2)).toBe('0.00');
      expect(result.finalCounterBalance.gt(new Big(0))).toBe(true);
    });

    it('deducts maker fees on limit orders', async () => {
      const strategy = new BuyBelowSellAboveStrategy({sellAbove: '50'});

      // Candle 1: close=100 > 50 → SELL_LIMIT advice
      // Candle 2: order fills
      const candles = [
        createCandle({open: '100', close: '100', low: '100', high: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '100', close: '100', low: '100', high: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange({baseBalance: '10', counterBalance: '0'}),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);

      // Selling 10 BTC at 100 USD = 1000 USD revenue
      // Limit fee: 0.15% of 1000 = 1.50
      const trade = result.trades[0];
      expect(trade.fee.toFixed(2)).toBe('1.50');
      expect(result.totalFees.toFixed(2)).toBe('1.50');
    });

    it('deducts taker fees on market orders', async () => {
      class AlwaysBuyMarket extends Strategy {
        static override NAME = 'AlwaysBuyMarket';
        #bought = false;

        protected override async processCandle(_candle: BatchedCandle): Promise<StrategyAdvice | void> {
          if (this.#bought) {
            return undefined;
          }

          this.#bought = true;

          return {
            amount: null,
            amountType: 'counter',
            price: null,
            signal: StrategySignal.BUY_MARKET,
          };
        }
      }

      // Candle 1: strategy says buy market
      // Candle 2: market order fills at candle 2's open price
      const candles = [
        createCandle({open: '50', close: '50', low: '50', high: '50', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '50', close: '50', low: '50', high: '50', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange(),
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

      // Need extra candles to account for 1-candle delay:
      // Candle 1: close=80 → BUY advice
      // Candle 2: buy fills, close=85 → BUY advice again
      // Candle 3: buy fills, close=115 → no trigger
      // Candle 4: close=130 → SELL advice
      // Candle 5: sell fills
      const candles = [
        createCandle({open: '80', close: '80', low: '78', high: '82', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '82', close: '85', low: '78', high: '90', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
        createCandle({open: '110', close: '115', low: '108', high: '118', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
        createCandle({open: '120', close: '130', low: '118', high: '135', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
        createCandle({open: '128', close: '132', low: '125', high: '135', openTimeInISO: '2025-01-01T00:04:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange(),
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
        createCandle({open: '100', close: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '100', close: '100', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange({baseBalance: '0', counterBalance: '1000'}),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      // Strategy advises sell, but base balance is 0
      expect(result.trades).toHaveLength(0);
      expect(result.finalBaseBalance.toFixed(2)).toBe('0.00');
      expect(result.finalCounterBalance.toFixed(2)).toBe('1000.00');
    });

    it('tracks the total number of candles processed', async () => {
      const strategy = new BuyBelowSellAboveStrategy({buyBelow: '1000'});

      const candles = [
        createCandle({open: '50', close: '50', low: '48', high: '52', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '55', close: '55', low: '48', high: '58', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
        createCandle({open: '60', close: '60', low: '58', high: '62', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
        createCandle({open: '65', close: '65', low: '63', high: '67', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
        createCandle({open: '70', close: '70', low: '68', high: '72', openTimeInISO: '2025-01-01T00:04:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange({counterBalance: '500'}),
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

        protected override async processCandle(candle: BatchedCandle): Promise<StrategyAdvice | void> {
          if (this.#sold) {
            return undefined;
          }
          this.#sold = true;
          return {
            amount: new Big(100),
            amountType: 'base',
            price: candle.close,
            signal: StrategySignal.SELL_LIMIT,
          };
        }
      }

      // Candle 1: strategy says sell 100, order placed (capped to 5)
      // Candle 2: order fills
      const candles = [
        createCandle({open: '50', close: '50', low: '50', high: '50', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '50', close: '50', low: '50', high: '50', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange({baseBalance: '5', counterBalance: '0'}),
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
      const candles: ExchangeCandle[] = [];
      const startTime = new Date('2025-01-06T00:00:00.000Z');
      const prices = [
        '45', '48', '55', '62', '65', '58', '52', '44', '42', '50',
        '55', '63', '68', '60', '53', '47', '43', '49', '56', '64',
        '70', '59', '51', '46', '40', '48', '57', '66', '72', '61',
        '54', '47', '43', '50', '58', '65', '71', '60', '52', '45',
        '41', '49', '56', '63', '69', '58', '50', '44', '42', '48',
        '55', '62',
      ] as const;

      prices.forEach((price, i) => {
        const time = new Date(startTime.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const priceNum = parseFloat(price);

        candles.push(
          createCandle({
            open: price,
            close: price,
            high: String(priceNum + 2),
            low: String(priceNum - 2),
            openTimeInISO: time.toISOString(),
            openTimeInMillis: time.getTime(),
            sizeInMillis: 7 * 24 * 60 * 60 * 1000,
          })
        );
      });

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange({counterBalance: '10000'}),
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
        createCandle({open: '40', close: '40', low: '38', high: '42', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '42', close: '45', low: '38', high: '48', openTimeInISO: '2025-01-15T00:00:00.000Z'}),
        createCandle({open: '90', close: '90', low: '88', high: '95', openTimeInISO: '2025-02-01T00:00:00.000Z'}),
        createCandle({open: '88', close: '85', low: '82', high: '92', openTimeInISO: '2025-02-15T00:00:00.000Z'}),
        createCandle({open: '35', close: '35', low: '33', high: '38', openTimeInISO: '2025-03-01T00:00:00.000Z'}),
        createCandle({open: '37', close: '40', low: '33', high: '42', openTimeInISO: '2025-03-15T00:00:00.000Z'}),
        createCandle({open: '85', close: '85', low: '83', high: '90', openTimeInISO: '2025-04-01T00:00:00.000Z'}),
        createCandle({open: '83', close: '80', low: '78', high: '88', openTimeInISO: '2025-04-15T00:00:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange(),
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

        protected override async processCandle(): Promise<StrategyAdvice | void> {
          if (this.#bought) {
            return undefined;
          }

          this.#bought = true;

          return {
            amount: null,
            amountType: 'counter',
            price: null,
            signal: StrategySignal.BUY_MARKET,
          };
        }
      }

      // Candle 1: strategy says buy, order placed
      // Candle 2: market order fills at open=100, then price goes to 150
      const candles = [
        createCandle({open: '100', close: '100', low: '100', high: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '100', close: '150', low: '100', high: '150', openTimeInISO: '2025-06-01T00:00:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange(),
        strategy: new BuyOnce(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();
      const {performance} = result;

      expect(performance.totalTrades).toBe(1);

      // Initial portfolio: 0 base * 150 (last close) + 1000 counter = 1000
      expect(performance.initialPortfolioValue.toFixed(2)).toBe('1000.00');

      // Bought BTC at 100, now worth more at 150
      expect(performance.finalPortfolioValue.gt(new Big(1400))).toBe(true);
      expect(performance.returnPercentage.gt(new Big(40))).toBe(true);
    });

    it('provides a complete performance summary for zero-trade runs', async () => {
      class NoOpStrategy extends Strategy {
        static override NAME = 'NoOp';

        protected override async processCandle(): Promise<StrategyAdvice | void> {
          return undefined;
        }
      }

      const candles = [createCandle({open: '100', close: '100'})];

      const config: BacktestConfig = {
        candles,
        exchange: createMockExchange(),
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
    const STRICT_TRADING_RULES: Omit<ExchangeTradingRules, 'pair'> = {
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
      return new AlpacaExchangeMock({balances, tradingRules: STRICT_TRADING_RULES});
    }

    it('skips buy trades when the computed size is below base_min_size', async () => {
      class AlwaysBuyMarket extends Strategy {
        static override NAME = 'AlwaysBuyMarket';

        protected override async processCandle(): Promise<StrategyAdvice | void> {
          return {
            amount: null,
            amountType: 'counter',
            price: null,
            signal: StrategySignal.BUY_MARKET,
          };
        }
      }

      // Two candles: advice on candle 1, would fill on candle 2
      const candles = [
        createCandle({open: '50000', close: '50000', low: '50000', high: '50000', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '50000', close: '50000', low: '50000', high: '50000', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        // Only $1 at price $50,000 can buy 0.00002 BTC, below min 0.0001
        exchange: createMockWithRules({counterBalance: '1'}),
        strategy: new AlwaysBuyMarket(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(0);
    });

    it('skips sell trades when the base balance is below base_min_size', async () => {
      class AlwaysSellMarket extends Strategy {
        static override NAME = 'AlwaysSellMarket';

        protected override async processCandle(): Promise<StrategyAdvice | void> {
          return {
            amount: null,
            amountType: 'base',
            price: null,
            signal: StrategySignal.SELL_MARKET,
          };
        }
      }

      const candles = [
        createCandle({open: '50000', close: '50000', low: '50000', high: '50000', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '50000', close: '50000', low: '50000', high: '50000', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockWithRules({baseBalance: '0.00005'}),
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
        createCandle({open: '80', close: '80', low: '78', high: '82', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '82', close: '85', low: '78', high: '90', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
        createCandle({open: '130', close: '130', low: '128', high: '135', openTimeInISO: '2025-01-02T00:00:00.000Z'}),
        createCandle({open: '128', close: '132', low: '125', high: '135', openTimeInISO: '2025-01-02T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        exchange: createMockWithRules(),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      // Buy at ~80, sell at ~130 — both should pass trading rules
      expect(result.trades).toHaveLength(2);
      expect(result.profitOrLoss.gt(0)).toBe(true);
    });
  });
});
