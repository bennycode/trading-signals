import {ms} from 'ms';
import type {FeeRate, TradingRules} from '../Broker.js';
import type {TradingPair} from '../TradingPair.js';
import {BrokerMock, type ExchangeMockBalance} from '../BrokerMock.js';
import {AlpacaBroker} from './AlpacaBroker.js';

export class AlpacaBrokerMock extends BrokerMock {
  readonly #feeRates: FeeRate;
  readonly #tradingRules: Omit<TradingRules, 'pair'>;

  constructor(config: {
    balances: Map<string, ExchangeMockBalance>;
    feeRates?: FeeRate;
    tradingRules?: Omit<TradingRules, 'pair'>;
  }) {
    super({balances: config.balances});
    this.#feeRates = config.feeRates ?? AlpacaBroker.DEFAULT_FEE_RATES;
    this.#tradingRules = config.tradingRules ?? AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES;
    this.setCachedFeeRates(this.#feeRates);
  }

  async getFeeRates(_pair: TradingPair): Promise<FeeRate> {
    return this.#feeRates;
  }

  async getTradingRules(pair: TradingPair): Promise<TradingRules> {
    return {
      ...this.#tradingRules,
      pair,
    };
  }

  getName(): string {
    return `${AlpacaBroker.NAME}Mock`;
  }

  getSmallestInterval(): number {
    return ms('1m');
  }
}
