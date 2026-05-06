import 'dotenv-defaults/config';
import {getTrading212Client} from '../getTrading212Client.js';

const usePaperTrading = process.env.TRADING212_USE_PAPER !== 'false';
const apiKey = usePaperTrading ? process.env.TRADING212_PAPER_API_KEY : process.env.TRADING212_LIVE_API_KEY;

const exchange = getTrading212Client({
  apiKey: apiKey ?? '',
  usePaperTrading,
});

// 1. Local time (Trading212 has no server-time endpoint)
const time = await exchange.getTime();
console.log(`[getTime] ${time}`);

// 2. Account balances (positions + cash)
const balances = await exchange.listBalances();
console.log(`[listBalances] ${balances.length} entries`);
console.log(balances);
