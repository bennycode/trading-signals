import assert from 'node:assert/strict';
import {loadEnvFiles} from '../../../util/loadEnvFiles.js';
import {Trading212API} from '../api/Trading212API.js';

loadEnvFiles('.env.live');

const apiKey = process.env.TRADING212_API_KEY;
const apiSecret = process.env.TRADING212_API_SECRET;
assert.ok(apiKey && apiSecret, 'Missing Trading212 live credentials');

const api = new Trading212API({apiKey, apiSecret, usePaperTrading: false});
const [positions, instruments] = await Promise.all([api.getPositions(), api.getInstruments()]);
const currencyByTicker = new Map(instruments.map(instrument => [instrument.ticker, instrument.currencyCode]));

for (const position of positions) {
  console.log(
    JSON.stringify({
      avg: position.averagePrice,
      currency: currencyByTicker.get(position.ticker) ?? '?',
      price: position.currentPrice,
      qty: position.quantity,
      t: position.ticker,
      unrealizedPnl: position.ppl,
    })
  );
}
