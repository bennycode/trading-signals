import {AlpacaExchangeMock, TradingPair} from '@typedtrader/exchange';
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

  const exchange = new AlpacaExchangeMock({
    balances: new Map([
      [tradingPair.base, {available: new Big(0), hold: new Big(0)}],
      [tradingPair.counter, {available: new Big(10000), hold: new Big(0)}],
    ]),
  });

  const result = await new BacktestExecutor({
    candles: candleData,
    exchange,
    strategy: new BuyOnceStrategy({buyAt: '50000'}),
    tradingPair,
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
  console.log(`Buy & Hold: ${performance.buyAndHoldReturnPercentage.toFixed(2)}%`);
  console.log(`Max Win Streak: ${performance.maxWinStreak}`);
  console.log(`Max Loss Streak: ${performance.maxLossStreak}`);
  console.log(`P&L: ${result.profitOrLoss.toFixed(2)} ${tradingPair.counter}`);
  console.log(`Fees: ${result.totalFees.toFixed(2)} ${tradingPair.counter}`);
  console.log(
    `Portfolio: ${performance.initialPortfolioValue.toFixed(2)} → ${performance.finalPortfolioValue.toFixed(2)} ${tradingPair.counter}`
  );
}

await run();
