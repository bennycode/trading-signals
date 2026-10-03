import '../loadEnv.js';
import {AlpacaMarketData, getTrading212Client, OrderSide, TradingPair} from '@typedtrader/exchange';
import {TradingSession} from '../trader/index.js';
import {BuyOnceStrategy} from '../strategy-buy-once/BuyOnceStrategy.js';

const marketData = new AlpacaMarketData({
  apiKey: process.env.ALPACA_LIVE_API_KEY!,
  apiSecret: process.env.ALPACA_LIVE_API_SECRET!,
  usePaperTrading: false,
});
const broker = getTrading212Client({
  apiKey: process.env.TRADING212_PAPER_API_KEY!,
  apiSecret: process.env.TRADING212_PAPER_API_SECRET!,
  marketData,
  usePaperTrading: true,
});

const strategy = new BuyOnceStrategy({
  protected: {takeProfitNominal: '0.10'},
  quantity: '1',
});

const pair = new TradingPair('AMD_US_EQ', 'USD');
const session = new TradingSession({broker, pair, strategy});

session.on('error', () => {});
session.on('orderFilled', () => {
  if (strategy.latestAdvice?.side === OrderSide.SELL) {
    void session.stop().then(() => {
      marketData.disconnect();
      broker.disconnect();
      process.exit(0);
    });
  }
});

await session.start();

setTimeout(async () => {
  await session.stop({cancelOpenOrders: true});
  marketData.disconnect();
  broker.disconnect();
  process.exit(0);
}, 15 * 60_000);
