import {Trading212Exchange} from './Trading212Exchange.js';

export function getTrading212Client(options: {
  apiKey: string;
  apiSecret: string;
  usePaperTrading: boolean;
}): Trading212Exchange {
  process.on('SIGINT', () => {
    console.log('Received signal interrupt...');
    exchange.disconnect();
    process.exit(0);
  });

  console.log('Initializing Trading212 client', {usePaperTrading: options.usePaperTrading});

  const exchange = new Trading212Exchange(options);

  return exchange;
}
