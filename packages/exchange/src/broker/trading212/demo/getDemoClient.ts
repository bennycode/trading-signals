import assert from 'node:assert/strict';
import {AlpacaMarketData} from '../../alpaca/AlpacaMarketData.js';
import type {Trading212Broker} from '../Trading212Broker.js';
import {getTrading212Client} from '../getTrading212Client.js';

/**
 * Demo scripts always run against the paper account; live access goes through the CLI,
 * which requires the explicit --live flag. Credentials come from `.env.sandbox` (loaded
 * by the calling demo script via `loadEnvFiles`).
 */
export function getDemoClient(): Trading212Broker {
  const apiKey = process.env.TRADING212_API_KEY;
  const apiSecret = process.env.TRADING212_API_SECRET;
  assert.ok(apiKey, 'Missing TRADING212_API_KEY in environment (.env.sandbox)');
  assert.ok(apiSecret, 'Missing TRADING212_API_SECRET in environment (.env.sandbox)');

  /*
   * Trading212 has no candle endpoints; Alpaca fills that gap. Always on the production
   * data hosts — Alpaca's sandbox data hosts are Broker-API-partner infrastructure and
   * reject regular account keys.
   */
  const alpacaKey = process.env.ALPACA_API_KEY;
  const alpacaSecret = process.env.ALPACA_API_SECRET;
  assert.ok(alpacaKey, 'Missing ALPACA_API_KEY in environment (Trading212 needs an external market-data source)');
  assert.ok(alpacaSecret, 'Missing ALPACA_API_SECRET in environment (Trading212 needs an external market-data source)');
  const marketData = new AlpacaMarketData({
    apiKey: alpacaKey,
    apiSecret: alpacaSecret,
    usePaperTrading: false,
  });

  return getTrading212Client({apiKey, apiSecret, marketData, usePaperTrading: true});
}
