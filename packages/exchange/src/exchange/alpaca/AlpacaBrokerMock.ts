import {ms} from 'ms';
import type {ExchangeFeeRate, ExchangeTradingRules} from '../Broker.js';
import type {TradingPair} from '../TradingPair.js';
import {BrokerMock, type ExchangeMockBalance} from '../BrokerMock.js';
import {AlpacaBroker} from './AlpacaBroker.js';

export class AlpacaBrokerMock extends BrokerMock {
  readonly #feeRates: ExchangeFeeRate;
  readonly #tradingRules: Omit<ExchangeTradingRules, 'pair'>;

  constructor(config: {
    balances: Map<string, ExchangeMockBalance>;
    feeRates?: ExchangeFeeRate;
    tradingRules?: Omit<ExchangeTradingRules, 'pair'>;
  }) {
    super({balances: config.balances});
    this.#feeRates = config.feeRates ?? AlpacaBroker.DEFAULT_FEE_RATES;
    this.#tradingRules = config.tradingRules ?? AlpacaBroker.DEFAULT_CRYPTO_TRADING_RULES;
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
    return `${AlpacaBroker.NAME}Mock`;
  }

  getSmallestInterval(): number {
    return ms('1m');
  }
}
