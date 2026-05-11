/* @see https://github.com/alpacahq/alpaca-ts/issues/106#issuecomment-1165948375 */
import type {MarketDataSource} from '../MarketDataSource.js';
import {AlpacaBroker} from './AlpacaBroker.js';
import {AlpacaMarketData} from './AlpacaMarketData.js';

/**
 * Tracks every (broker, owned-data-source) pair this factory has constructed so a single
 * SIGINT handler can close them all. Without this guard, repeated `getAlpacaClient()` calls
 * (e.g. one per request in a command handler) would accumulate listeners on `process` and
 * trigger duplicate disconnects.
 */
const trackedBrokers: Array<{broker: AlpacaBroker; ownedMarketData: AlpacaMarketData | null}> = [];
let sigintRegistered = false;

function ensureSigintHandler() {
  if (sigintRegistered) {
    return;
  }
  sigintRegistered = true;
  process.on('SIGINT', () => {
    console.log('Received signal interrupt...');
    for (const {broker, ownedMarketData} of trackedBrokers) {
      broker.disconnect();
      ownedMarketData?.disconnect();
    }
    console.log(`Sent WebSocket disconnect.`);
    process.exit(0);
  });
}

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

  const ownedMarketData = options.marketData ? null : new AlpacaMarketData(options);
  const marketData = options.marketData ?? ownedMarketData!;
  const broker = new AlpacaBroker({...options, marketData});

  trackedBrokers.push({broker, ownedMarketData});
  ensureSigintHandler();

  return broker;
}
