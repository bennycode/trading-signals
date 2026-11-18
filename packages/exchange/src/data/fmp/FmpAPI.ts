import axios from 'axios';
import axiosRetry from 'axios-retry';
import {ms} from 'ms';
import {z} from 'zod';
import {FmpAnalystEstimateSchema} from './schema/FmpAnalystEstimateSchema.js';
import {FmpPriceTargetConsensusSchema} from './schema/FmpPriceTargetConsensusSchema.js';
import {FmpPriceTargetSummarySchema} from './schema/FmpPriceTargetSummarySchema.js';
import {FmpQuoteSchema} from './schema/FmpQuoteSchema.js';
import {FmpRatingsSnapshotSchema} from './schema/FmpRatingsSnapshotSchema.js';
import {simplifyError} from '../../util/simplifyError.js';

/**
 * Read-only client for Financial Modeling Prep's "stable" REST API. Covers the handful of
 * research endpoints the momentum scorecard needs: quotes, analyst price-target consensus,
 * forward EPS estimates, and the aggregate rating. The API key is sent as the `apikey` query
 * parameter on every request, per FMP's convention.
 *
 * @see https://site.financialmodelingprep.com/developer/docs/stable
 */
export class FmpAPI {
  readonly #client;

  constructor(options: {apiKey: string}) {
    this.#client = axios.create({
      baseURL: 'https://financialmodelingprep.com/stable',
      params: {apikey: options.apiKey},
    });
    axiosRetry(this.#client, {
      retries: 5,
      retryDelay: retryCount => retryCount * ms('1s'),
    });
    simplifyError(this.#client);
  }

  /** @see https://site.financialmodelingprep.com/developer/docs/stable#quote */
  async getQuote(symbol: string) {
    const response = await this.#client.get('/quote', {params: {symbol}});
    return z.array(FmpQuoteSchema).parse(response.data)[0];
  }

  /** @see https://site.financialmodelingprep.com/developer/docs/stable#price-target-consensus */
  async getPriceTargetConsensus(symbol: string) {
    const response = await this.#client.get('/price-target-consensus', {params: {symbol}});
    return z.array(FmpPriceTargetConsensusSchema).parse(response.data)[0];
  }

  /** @see https://site.financialmodelingprep.com/developer/docs/stable#analyst-estimates */
  async getAnalystEstimates(symbol: string, period: 'annual' | 'quarter' = 'annual') {
    const response = await this.#client.get('/analyst-estimates', {params: {period, symbol}});
    return z.array(FmpAnalystEstimateSchema).parse(response.data);
  }

  /** @see https://site.financialmodelingprep.com/developer/docs/stable#ratings-snapshot */
  async getRatingsSnapshot(symbol: string) {
    const response = await this.#client.get('/ratings-snapshot', {params: {symbol}});
    return z.array(FmpRatingsSnapshotSchema).parse(response.data)[0];
  }

  /** @see https://site.financialmodelingprep.com/developer/docs/stable#price-target-summary */
  async getPriceTargetSummary(symbol: string) {
    const response = await this.#client.get('/price-target-summary', {params: {symbol}});
    return z.array(FmpPriceTargetSummarySchema).parse(response.data)[0];
  }
}
