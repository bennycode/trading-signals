import 'dotenv-defaults/config';
import {getDemoClient} from './getDemoClient.js';

const exchange = getDemoClient();

// 1. Local time (Trading212 has no server-time endpoint)
const time = await exchange.getTime();
console.log(`[getTime] ${time}`);

// 2. Account balances (positions + cash)
const balances = await exchange.listBalances();
console.log(`[listBalances] ${balances.length} entries`);
console.log(balances);
