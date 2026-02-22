import {ms} from 'ms';
import type {ExchangeFeeRate, ExchangeTradingRules} from '../Exchange.js';
import type {TradingPair} from '../TradingPair.js';
import {ExchangeMock, type ExchangeMockBalance} from '../ExchangeMock.js';
import {AlpacaExchange} from './AlpacaExchange.js';

export class AlpacaExchangeMock extends ExchangeMock {
  readonly #feeRates: ExchangeFeeRate;
  readonly #tradingRules: Omit<ExchangeTradingRules, 'pair'>;

  constructor(config: {
    balances: Map<string, ExchangeMockBalance>;
    feeRates?: ExchangeFeeRate;
    tradingRules?: Omit<ExchangeTradingRules, 'pair'>;
  }) {
    super({balances: config.balances});
    this.#feeRates = config.feeRates ?? AlpacaExchange.DEFAULT_FEE_RATES;
    this.#tradingRules = config.tradingRules ?? AlpacaExchange.DEFAULT_CRYPTO_TRADING_RULES;
    this.setCachedFeeRates(this.#feeRates);
  }

  async getFeeRates(_pair: TradingPair): Promise<ExchangeFeeRate> {
    return this.#feeRates;
  }

  async getTradingRules(pair: TradingPair): Promise<ExchangeTradingRules> {
    return {
      ...this.#tradingRules,
      pair,
    };
  }

  getName(): string {
    return `${AlpacaExchange.NAME}Mock`;
  }

  getSmallestInterval(): number {
    return ms('1m');
  }
}
