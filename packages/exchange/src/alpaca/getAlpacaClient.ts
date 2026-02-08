/* @see https://github.com/alpacahq/alpaca-ts/issues/106#issuecomment-1165948375 */
import {AlpacaExchange} from './AlpacaExchange.js';

export function getAlpacaClient(options: {apiKey: string; apiSecret: string; usePaperTrading: boolean}) {
  process.on('SIGINT', () => {
    console.log('Received signal interrupt...');
    exchange.disconnect();
    console.log(`Sent WebSocket disconnect.`);
    process.exit(0);
  });

  console.log('Initializing Alpaca client', {usePaperTrading: options.usePaperTrading});

  const exchange = new AlpacaExchange(options);

  return exchange;
}
