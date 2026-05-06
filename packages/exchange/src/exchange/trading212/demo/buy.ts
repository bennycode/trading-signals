import 'dotenv-defaults/config';
import {ExchangeOrderSide} from '../../Exchange.js';
import {TradingPair} from '../../TradingPair.js';
import {getTrading212Client} from '../getTrading212Client.js';

const usePaperTrading = process.env.TRADING212_USE_PAPER !== 'false';
const apiKey = usePaperTrading ? process.env.TRADING212_PAPER_API_KEY : process.env.TRADING212_LIVE_API_KEY;

const exchange = getTrading212Client({
  apiKey: apiKey ?? '',
  usePaperTrading,
});

const pair = new TradingPair('AAPL_US_EQ', 'USD');

console.log(`[placeMarketOrder] BUY 1 ${pair.base} on ${usePaperTrading ? 'PAPER' : 'LIVE'} account`);

const order = await exchange.placeMarketOrder(pair, {
  side: ExchangeOrderSide.BUY,
  size: '1',
  sizeInCounter: false,
});

console.log('[placeMarketOrder] Pending order:', order);
