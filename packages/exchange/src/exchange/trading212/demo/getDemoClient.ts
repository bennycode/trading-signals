import assert from 'node:assert/strict';
import {AlpacaMarketData} from '../../alpaca/AlpacaMarketData.js';
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

  // Trading212 has no candle endpoints; the demo wires AlpacaMarketData with separate
  // Alpaca paper credentials so candle methods on the broker work end-to-end.
  const alpacaKey = process.env.ALPACA_PAPER_API_KEY;
  const alpacaSecret = process.env.ALPACA_PAPER_API_SECRET;
  assert.ok(alpacaKey, 'Missing ALPACA_PAPER_API_KEY in environment (Trading212 needs an external market-data source)');
  assert.ok(
    alpacaSecret,
    'Missing ALPACA_PAPER_API_SECRET in environment (Trading212 needs an external market-data source)'
  );
  const marketData = new AlpacaMarketData({
    apiKey: alpacaKey,
    apiSecret: alpacaSecret,
    usePaperTrading: true,
  });

  return getTrading212Client({apiKey, apiSecret, marketData, usePaperTrading});
}
