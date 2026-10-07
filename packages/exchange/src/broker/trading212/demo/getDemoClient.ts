import assert from 'node:assert/strict';
import {AlpacaMarketData} from '../../alpaca/AlpacaMarketData.js';
import type {Trading212Broker} from '../Trading212Broker.js';
import {getTrading212Client} from '../getTrading212Client.js';

export function getDemoClient(): Trading212Broker {
  const apiKey = process.env.TRADING212_PAPER_API_KEY;
  const apiSecret = process.env.TRADING212_PAPER_API_SECRET;
  assert.ok(apiKey, 'Missing TRADING212_PAPER_API_KEY in environment');
  assert.ok(apiSecret, 'Missing TRADING212_PAPER_API_SECRET in environment');

  /*
   * Trading212 has no candle endpoints; the demo wires AlpacaMarketData with separate
   * Alpaca paper credentials so candle methods on the broker work end-to-end.
   */
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

  return getTrading212Client({apiKey, apiSecret, marketData, usePaperTrading: true});
}
