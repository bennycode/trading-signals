import {TwelveDataMarketData, type TwelveDataMarketDataOptions} from './TwelveDataMarketData.js';

export function getTwelveDataMarketData(options: TwelveDataMarketDataOptions) {
  console.log('Initializing Twelve Data market data');

  const marketData = new TwelveDataMarketData(options);

  process.on('SIGINT', () => {
    console.log('Received signal interrupt...');
    marketData.disconnect();
    process.exit(0);
  });

  return marketData;
}
