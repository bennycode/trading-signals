import 'dotenv-defaults/config.js';
import {getAlpacaClient} from './alpaca/getAlpacaClient.js';

const usePaperTrading = process.env.ALPACA_USE_PAPER === 'true';
const apiKey = usePaperTrading ? (process.env.ALPACA_PAPER_API_KEY ?? '') : (process.env.ALPACA_LIVE_API_KEY ?? '');
const apiSecret = usePaperTrading
  ? (process.env.ALPACA_PAPER_API_SECRET ?? '')
  : (process.env.ALPACA_LIVE_API_SECRET ?? '');

const client = getAlpacaClient({
  apiKey,
  apiSecret,
  usePaperTrading,
});

console.log('paper trading', usePaperTrading);

console.log('time', await client.getTime());
