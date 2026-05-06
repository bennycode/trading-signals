import assert from 'node:assert/strict';
import {Trading212Exchange} from '../Trading212Exchange.js';
import {getTrading212Client} from '../getTrading212Client.js';

export function getDemoClient(): Trading212Exchange {
  const usePaperTrading = process.env.TRADING212_USE_PAPER !== 'false';
  const keyVar = usePaperTrading ? 'TRADING212_PAPER_API_KEY' : 'TRADING212_LIVE_API_KEY';
  const secretVar = usePaperTrading ? 'TRADING212_PAPER_API_SECRET' : 'TRADING212_LIVE_API_SECRET';
  const apiKey = process.env[keyVar];
  const apiSecret = process.env[secretVar];
  assert.ok(apiKey, `Missing ${keyVar} in environment`);
  assert.ok(apiSecret, `Missing ${secretVar} in environment`);

  return getTrading212Client({apiKey, apiSecret, usePaperTrading});
}
