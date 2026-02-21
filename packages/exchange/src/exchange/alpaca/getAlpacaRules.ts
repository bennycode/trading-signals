import type {ExchangeFeeRate, ExchangeTradingRules} from '../Exchange.js';
import type {TradingPair} from '../TradingPair.js';
import {AlpacaExchange} from './AlpacaExchange.js';
import {getAlpacaClient} from './getAlpacaClient.js';

export interface AlpacaRules {
  feeRates: ExchangeFeeRate;
  tradingRules: ExchangeTradingRules;
}

/**
 * Returns Alpaca fee rates and trading rules for a given trading pair.
 *
 * Uses live values when `options` (API credentials) are provided, otherwise uses default values.
 */
export async function getAlpacaRules(
  pair: TradingPair,
  options?: {apiKey: string; apiSecret: string; usePaperTrading: boolean}
): Promise<AlpacaRules> {
  if (options) {
    const exchange = getAlpacaClient(options);
    const [feeRates, tradingRules] = await Promise.all([exchange.getFeeRates(pair), exchange.getTradingRules(pair)]);
    return {feeRates, tradingRules};
  }

  return {
    feeRates: AlpacaExchange.DEFAULT_FEE_RATES,
    tradingRules: {
      ...AlpacaExchange.DEFAULT_CRYPTO_TRADING_RULES,
      pair,
    },
  };
}
