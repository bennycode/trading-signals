import type {MarketDataSource} from '../MarketDataSource.js';
import {Trading212Exchange} from './Trading212Exchange.js';

export function getTrading212Client(options: {
  apiKey: string;
  apiSecret: string;
  usePaperTrading: boolean;
  marketData?: MarketDataSource;
}): Trading212Exchange {
  console.log('Initializing Trading212 client', {usePaperTrading: options.usePaperTrading});
  return new Trading212Exchange(options);
}
