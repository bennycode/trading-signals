import {AlpacaMarketData, type AlpacaMarketDataOptions} from './AlpacaMarketData.js';

export function getAlpacaMarketData(options: AlpacaMarketDataOptions) {
  console.log('Initializing Alpaca market data');

  const marketData = new AlpacaMarketData(options);

  process.on('SIGINT', () => {
    console.log('Received signal interrupt...');
    marketData.disconnect();
    process.exit(0);
  });

  return marketData;
}
