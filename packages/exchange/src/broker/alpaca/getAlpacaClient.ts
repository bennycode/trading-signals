/* @see https://github.com/alpacahq/alpaca-ts/issues/106#issuecomment-1165948375 */
import type {MarketDataSource} from '../MarketDataSource.js';
import {AlpacaBroker} from './AlpacaBroker.js';
import {AlpacaMarketData} from './AlpacaMarketData.js';

export function getAlpacaClient(options: {
  apiKey: string;
  apiSecret: string;
  usePaperTrading: boolean;
  /**
   * Optional market-data source. When omitted, an `AlpacaMarketData` is constructed from
   * the same credentials so the broker is fully usable on its own. Pass an existing source
   * (e.g. one already feeding another broker) to share connections.
   */
  marketData?: MarketDataSource;
}) {
  console.log('Initializing Alpaca client', {usePaperTrading: options.usePaperTrading});

  const marketData = options.marketData ?? new AlpacaMarketData(options);
  const exchange = new AlpacaBroker({...options, marketData});

  process.on('SIGINT', () => {
    console.log('Received signal interrupt...');
    exchange.disconnect();
    if (!options.marketData) {
      // Only close the data source we created ourselves; an injected one is owned by the caller.
      marketData.disconnect();
    }
    console.log(`Sent WebSocket disconnect.`);
    process.exit(0);
  });

  return exchange;
}
