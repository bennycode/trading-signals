import type {MarketDataSource} from '../MarketDataSource.js';
import {Trading212Broker} from './Trading212Broker.js';

export function getTrading212Client(options: {
  apiKey: string;
  apiSecret: string;
  usePaperTrading: boolean;
  marketData: MarketDataSource;
}): Trading212Broker {
  console.log('Initializing Trading212 client', {usePaperTrading: options.usePaperTrading});
  return new Trading212Broker(options);
}
