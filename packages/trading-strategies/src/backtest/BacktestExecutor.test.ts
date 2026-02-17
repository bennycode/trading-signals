import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaExchange, ExchangeOrderType} from '@typedtrader/exchange';
import type {ExchangeCandle, ExchangeFeeRate, ExchangeTradingRules} from '@typedtrader/exchange';
import {TradingPair} from '@typedtrader/exchange';
import {BacktestExecutor} from './BacktestExecutor.js';
import {BuyBelowSellAboveStrategy} from '../strategy-buy-below-sell-above/BuyBelowSellAboveStrategy.js';
import {StrategySignal} from '../strategy/StrategySignal.js';
import type {BacktestConfig} from './BacktestConfig.js';
import {Strategy} from '../strategy/Strategy.js';
import type {StrategyAdvice} from '../strategy/StrategyAdvice.js';
import type {BatchedCandle} from '@typedtrader/exchange';

const ALPACA_FEES = AlpacaExchange.DEFAULT_FEE_RATES;

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
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(1),
        initialCounterBalance: new Big(1000),
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
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(1000),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(0);
      expect(result.totalCandles).toBe(0);
      expect(result.profitOrLoss.toFixed(2)).toBe('0.00');
    });

    it('executes a buy when price drops below the buyBelow threshold', async () => {
      const strategy = new BuyBelowSellAboveStrategy({buyBelow: '100'});

      const candles = [
        createCandle({open: '110', close: '110'}),
        createCandle({open: '95', close: '90', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(1000),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.advice.signal).toBe(StrategySignal.BUY_LIMIT);
      expect(trade.price.toFixed(2)).toBe('90.00');
      expect(result.finalCounterBalance.lt(new Big(1000))).toBe(true);
      expect(result.finalBaseBalance.gt(new Big(0))).toBe(true);
    });

    it('executes a sell when price rises above the sellAbove threshold', async () => {
      const strategy = new BuyBelowSellAboveStrategy({sellAbove: '100'});

      const candles = [
        createCandle({open: '90', close: '90'}),
        createCandle({open: '105', close: '110', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(2),
        initialCounterBalance: new Big(0),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);

      const trade = result.trades[0];
      expect(trade.advice.signal).toBe(StrategySignal.SELL_LIMIT);
      expect(trade.price.toFixed(2)).toBe('110.00');
      expect(result.finalBaseBalance.toFixed(2)).toBe('0.00');
      expect(result.finalCounterBalance.gt(new Big(0))).toBe(true);
    });

    it('deducts maker fees on limit orders', async () => {
      const strategy = new BuyBelowSellAboveStrategy({sellAbove: '50'});

      const candles = [createCandle({open: '100', close: '100'})];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(10),
        initialCounterBalance: new Big(0),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);

      // Selling 10 BTC at 100 USD = 1000 USD revenue
      // Limit fee: 0.15% of 1000 = 1.50
      // Net revenue: 998.50
      const trade = result.trades[0];
      expect(trade.fee.toFixed(2)).toBe('1.50');
      expect(result.finalCounterBalance.toFixed(2)).toBe('998.50');
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

      const candles = [createCandle({open: '50', close: '50'})];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(1000),
        strategy: new AlwaysBuyMarket(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);

      // Spending 1000 USD at market price 50
      // Market fee: 0.25% of 1000 = 2.50
      // Net spend: 997.50
      // Size: 997.50 / 50 = 19.95
      const trade = result.trades[0];
      expect(trade.fee.toFixed(2)).toBe('2.50');
      expect(trade.size.toFixed(2)).toBe('19.95');
      expect(result.finalCounterBalance.toFixed(2)).toBe('0.00');
      expect(result.finalBaseBalance.toFixed(2)).toBe('19.95');
    });

    it('runs a full buy-and-sell cycle and computes profit/loss', async () => {
      const strategy = new BuyBelowSellAboveStrategy({
        buyBelow: '100',
        sellAbove: '120',
      });

      const candles = [
        createCandle({open: '80', close: '80', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '85', close: '90', openTimeInISO: '2025-01-01T00:01:00.000Z'}),
        createCandle({open: '110', close: '115', openTimeInISO: '2025-01-01T00:02:00.000Z'}),
        createCandle({open: '120', close: '130', openTimeInISO: '2025-01-01T00:03:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(1000),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      // First candle: close=80 < 100 → BUY_LIMIT at 80
      // Second candle: close=90 < 100 → BUY_LIMIT at 90 (but we now have less counter)
      // Third candle: close=115, no trigger
      // Fourth candle: close=130 > 120 → SELL_LIMIT at 130
      expect(result.trades.length).toBeGreaterThanOrEqual(2);
      expect(result.trades[0].advice.signal).toBe(StrategySignal.BUY_LIMIT);
      expect(result.trades[result.trades.length - 1].advice.signal).toBe(StrategySignal.SELL_LIMIT);

      // Overall, bought low and sold high, so we expect profit
      expect(result.profitOrLoss.gt(0)).toBe(true);
      expect(result.totalFees.gt(0)).toBe(true);
    });

    it('skips trades when there is insufficient balance', async () => {
      const strategy = new BuyBelowSellAboveStrategy({sellAbove: '50'});

      const candles = [createCandle({open: '100', close: '100'})];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(1000),
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
        createCandle({open: '50', close: '50'}),
        createCandle({open: '55', close: '55'}),
        createCandle({open: '60', close: '60'}),
        createCandle({open: '65', close: '65'}),
        createCandle({open: '70', close: '70'}),
      ];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(500),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.totalCandles).toBe(5);
    });

    it('caps sell size to available base balance', async () => {
      class SellTooMuch extends Strategy {
        static override NAME = 'SellTooMuch';

        protected override async processCandle(candle: BatchedCandle): Promise<StrategyAdvice | void> {
          return {
            amount: new Big(100),
            amountType: 'base',
            price: candle.close,
            signal: StrategySignal.SELL_LIMIT,
          };
        }
      }

      const candles = [createCandle({open: '50', close: '50'})];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(5),
        initialCounterBalance: new Big(0),
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

      // Simulate 12 months of price oscillations (one candle per "week")
      const candles: ExchangeCandle[] = [];
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

        candles.push(
          createCandle({
            open: price,
            close: price,
            high: price,
            low: price,
            openTimeInISO: time.toISOString(),
            openTimeInMillis: time.getTime(),
            sizeInMillis: 7 * 24 * 60 * 60 * 1000,
          })
        );
      });

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(10000),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();
      const {performance} = result;

      // Verify multiple trades happened
      expect(performance.totalTrades).toBeGreaterThan(10);

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

      const candles = [
        createCandle({open: '40', close: '40', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '90', close: '90', openTimeInISO: '2025-02-01T00:00:00.000Z'}),
        createCandle({open: '35', close: '35', openTimeInISO: '2025-03-01T00:00:00.000Z'}),
        createCandle({open: '85', close: '85', openTimeInISO: '2025-04-01T00:00:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(1000),
        strategy,
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();
      const {performance} = result;

      // Two full buy-sell cycles, both profitable (bought at 40/35, sold at 90/85)
      expect(performance.totalTrades).toBe(4);
      expect(performance.winRate.toFixed(0)).toBe('100');
      expect(performance.returnPercentage.gt(0)).toBe(true);
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

      const candles = [
        createCandle({open: '100', close: '100', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '150', close: '150', openTimeInISO: '2025-06-01T00:00:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(1000),
        strategy: new BuyOnce(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();
      const {performance} = result;

      expect(performance.totalTrades).toBe(1);

      // Initial portfolio: 0 base * 150 (last close) + 1000 counter = 1000
      expect(performance.initialPortfolioValue.toFixed(2)).toBe('1000.00');

      // Bought ~9.975 BTC at 100, now worth ~9.975 * 150 = ~1496.25
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
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(1000),
        strategy: new NoOpStrategy(),
        tradingPair,
      };

      const result = await new BacktestExecutor(config).execute();
      const {performance} = result;

      expect(performance.totalTrades).toBe(0);
      expect(performance.winRate.toFixed(2)).toBe('0.00');
      expect(performance.returnPercentage.toFixed(2)).toBe('0.00');
    });
  });

  describe('tradingRules', () => {
    /** BTC/USD-like trading rules: min 0.0001 BTC, increment 0.0001, price increment $0.01, min notional $1 */
    const BTC_TRADING_RULES: ExchangeTradingRules = {
      base_increment: '0.0001',
      base_max_size: '100',
      base_min_size: '0.0001',
      counter_increment: '0.01',
      counter_min_size: '1',
      pair: new TradingPair('BTC', 'USD'),
    };

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

      const candles = [createCandle({open: '50000', close: '50000'})];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        // Only $1 at price $50,000 can buy 0.00002 BTC, below min 0.0001
        initialCounterBalance: new Big(1),
        strategy: new AlwaysBuyMarket(),
        tradingPair,
        tradingRules: BTC_TRADING_RULES,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(0);
      expect(result.finalCounterBalance.toFixed(2)).toBe('1.00');
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

      const candles = [createCandle({open: '50000', close: '50000'})];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big('0.00005'),
        initialCounterBalance: new Big(0),
        strategy: new AlwaysSellMarket(),
        tradingPair,
        tradingRules: BTC_TRADING_RULES,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(0);
      expect(result.finalBaseBalance.toFixed(5)).toBe('0.00005');
    });

    it('rounds buy size down to the nearest base_increment', async () => {
      class BuySpecificAmount extends Strategy {
        static override NAME = 'BuySpecificAmount';
        #bought = false;

        protected override async processCandle(): Promise<StrategyAdvice | void> {
          if (this.#bought) {
            return undefined;
          }

          this.#bought = true;

          return {
            amount: new Big('0.12345678'),
            amountType: 'base',
            price: null,
            signal: StrategySignal.BUY_MARKET,
          };
        }
      }

      const candles = [createCandle({open: '100', close: '100'})];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(10000),
        strategy: new BuySpecificAmount(),
        tradingPair,
        tradingRules: BTC_TRADING_RULES,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(1);
      // 0.12345678 rounded down to increment 0.0001 → 0.1234
      expect(result.trades[0].size.toFixed(4)).toBe('0.1234');
    });

    it('skips trades when the notional value is below counter_min_size', async () => {
      class BuyTiny extends Strategy {
        static override NAME = 'BuyTiny';
        #bought = false;

        protected override async processCandle(): Promise<StrategyAdvice | void> {
          if (this.#bought) {
            return undefined;
          }

          this.#bought = true;

          return {
            amount: new Big('0.0001'),
            amountType: 'base',
            price: null,
            signal: StrategySignal.BUY_MARKET,
          };
        }
      }

      // With price $1, notional = 0.0001 * 1 = $0.0001, below min $1
      const candles = [createCandle({open: '1', close: '1'})];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(10000),
        strategy: new BuyTiny(),
        tradingPair,
        tradingRules: BTC_TRADING_RULES,
      };

      const result = await new BacktestExecutor(config).execute();

      expect(result.trades).toHaveLength(0);
    });

    it('allows trades that meet all trading rule requirements', async () => {
      const strategy = new BuyBelowSellAboveStrategy({
        buyBelow: '100',
        sellAbove: '120',
      });

      const candles = [
        createCandle({open: '80', close: '80', openTimeInISO: '2025-01-01T00:00:00.000Z'}),
        createCandle({open: '130', close: '130', openTimeInISO: '2025-01-02T00:00:00.000Z'}),
      ];

      const config: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(1000),
        strategy,
        tradingPair,
        tradingRules: BTC_TRADING_RULES,
      };

      const result = await new BacktestExecutor(config).execute();

      // Buy at 80, sell at 130 — both should pass trading rules
      expect(result.trades).toHaveLength(2);
      expect(result.trades[0].advice.signal).toBe(StrategySignal.BUY_LIMIT);
      expect(result.trades[1].advice.signal).toBe(StrategySignal.SELL_LIMIT);
      expect(result.profitOrLoss.gt(0)).toBe(true);
    });

    it('prevents dust trades that would occur without trading rules', async () => {
      class AlternateBuySell extends Strategy {
        static override NAME = 'AlternateBuySell';
        #isBuying = true;

        protected override async processCandle(): Promise<StrategyAdvice | void> {
          const signal = this.#isBuying ? StrategySignal.BUY_MARKET : StrategySignal.SELL_MARKET;
          this.#isBuying = !this.#isBuying;

          return {
            amount: null,
            amountType: 'base',
            price: null,
            signal,
          };
        }
      }

      const candles = Array.from({length: 50}, (_, i) =>
        createCandle({
          open: '100',
          close: '100',
          openTimeInISO: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString(),
          openTimeInMillis: Date.UTC(2025, 0, 1, 0, i),
        })
      );

      // Rules with a higher counter_min_size to trigger rejection sooner
      const strictRules: ExchangeTradingRules = {
        base_increment: '0.0001',
        base_max_size: '100',
        base_min_size: '0.0001',
        counter_increment: '0.01',
        counter_min_size: '10',
        pair: tradingPair,
      };

      // Without trading rules: all trades execute (sizes get tiny but continue)
      const configWithout: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(11),
        strategy: new AlternateBuySell(),
        tradingPair,
      };

      const resultWithout = await new BacktestExecutor(configWithout).execute();

      // With trading rules: trades stop once notional (size × price) drops below $10
      const configWith: BacktestConfig = {
        candles,
        feeRates: ALPACA_FEES,
        initialBaseBalance: new Big(0),
        initialCounterBalance: new Big(11),
        strategy: new AlternateBuySell(),
        tradingPair,
        tradingRules: strictRules,
      };

      const resultWith = await new BacktestExecutor(configWith).execute();

      // Without rules, all candles produce trades
      expect(resultWithout.trades.length).toBe(50);

      // With rules, trades stop once balances drop below minimums
      expect(resultWith.trades.length).toBeLessThan(resultWithout.trades.length);
      expect(resultWith.trades.length).toBeGreaterThan(0);
    });
  });
});
