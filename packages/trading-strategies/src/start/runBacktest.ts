import {getAlpacaRules, TradingPair} from '@typedtrader/exchange';
import Big from 'big.js';
import {BacktestExecutor} from '../backtest/BacktestExecutor.js';
import candleData from '../backtest/candles/BNB_USDT_2021_02_19_1_week.json' with {type: 'json'};
import {BuyOnceStrategy} from '../strategy-buy-once/BuyOnceStrategy.js';

async function run() {
  const firstCandle = candleData[0];
  const lastCandle = candleData[candleData.length - 1];
  const tradingPair = new TradingPair(firstCandle.base, firstCandle.counter);

  console.log(`Loaded "${candleData.length}" candles`);
  console.log(`Period: ${firstCandle.openTimeInISO} → ${lastCandle.openTimeInISO}`);
  console.log(`First close: ${firstCandle.close}`);
  console.log(`Last close: ${lastCandle.close}`);
  console.log('---');

  const {feeRates, tradingRules} = await getAlpacaRules(tradingPair);

  const result = await new BacktestExecutor({
    candles: candleData,
    feeRates,
    initialBaseBalance: new Big(0),
    initialCounterBalance: new Big(10000),
    strategy: new BuyOnceStrategy({buyAt: '50000'}),
    tradingPair,
    tradingRules,
  }).execute();

  const {performance} = result;

  console.log('=== BACKTEST RESULTS ===');
  console.log(`Strategy: ${BuyOnceStrategy.NAME}`);
  console.log(`Pair: ${tradingPair.base}/${tradingPair.counter}`);
  console.log(`Period: ${firstCandle.openTimeInISO} → ${lastCandle.openTimeInISO}`);
  console.log(`Candles: ${result.totalCandles}`);
  console.log(`Trades: ${performance.totalTrades}`);
  console.log(`Win Rate: ${performance.winRate.toFixed(2)}%`);
  console.log(`Return: ${performance.returnPercentage.toFixed(2)}%`);
  console.log(`P&L: ${result.profitOrLoss.toFixed(2)} ${tradingPair.counter}`);
  console.log(`Fees: ${result.totalFees.toFixed(2)} ${tradingPair.counter}`);
  console.log(
    `Portfolio: ${performance.initialPortfolioValue.toFixed(2)} → ${performance.finalPortfolioValue.toFixed(2)} ${tradingPair.counter}`
  );
}

await run();
