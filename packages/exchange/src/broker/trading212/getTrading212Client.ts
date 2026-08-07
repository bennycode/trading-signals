import type {MarketDataSource} from '../MarketDataSource.js';
import {Trading212Broker} from './Trading212Broker.js';

export function getTrading212Client(options: {
  apiKey: string;
  apiSecret: string;
  usePaperTrading: boolean;
  marketData: MarketDataSource;
}): Trading212Broker {
  return new Trading212Broker(options);
}
