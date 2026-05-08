import 'dotenv-defaults/config';
import {ExchangeOrderSide} from '../../Broker.js';
import {TradingPair} from '../../TradingPair.js';
import {getDemoClient} from './getDemoClient.js';

const exchange = getDemoClient();

const pair = new TradingPair('AAPL_US_EQ', 'USD');

console.log(`[placeMarketOrder] BUY 1 ${pair.base}`);

const order = await exchange.placeMarketOrder(pair, {
  side: ExchangeOrderSide.BUY,
  size: '1',
  sizeInCounter: false,
});

console.log('[placeMarketOrder] Pending order:', order);
