import {SimplifiedHttpError} from '../../util/SimplifiedHttpError.js';
import type {AlpacaAPI} from './api/AlpacaAPI.js';
import type {TradingPair} from '../TradingPair.js';

/** Alpaca renders crypto pairs as `BASE/COUNTER` and stocks as the bare ticker. */
export function createAlpacaSymbol(pair: TradingPair, isCrypto: boolean) {
  if (isCrypto) {
    return `${pair.base}/${pair.counter}`;
  }
  return pair.base;
}

/**
 * Probes the crypto market-data endpoint to decide whether a symbol is crypto.
 * 4xx responses mean "not crypto"; other errors propagate.
 */
export async function isAlpacaCryptoSymbol(api: AlpacaAPI, pair: TradingPair) {
  try {
    const response = await api.getCryptoBarsLatest({symbols: createAlpacaSymbol(pair, true)});
    return Object.keys(response.bars).length > 0;
  } catch (error) {
    if (error instanceof SimplifiedHttpError && error.status >= 400 && error.status < 500) {
      return false;
    }
    throw error;
  }
}
