import axios, {type AxiosError} from 'axios';
import axiosRetry from 'axios-retry';
import {BarsResponseSchema, LatestBarsResponseSchema} from './schema/BarSchema.js';
import {ClockSchema} from './schema/ClockSchema.js';

function hasResponseCode(error: AxiosError): error is AxiosError<{code: number}> {
  const data = error.response?.data;
  return !!data && typeof data === 'object' && 'code' in data && typeof data.code === 'number';
}

export class AlpacaAPI {
  readonly #tradingClient;
  readonly #marketDataClient;

  constructor(options: {apiKey: string; apiSecret: string; usePaperTrading: boolean}) {
    const headers = {
      'APCA-API-KEY-ID': options.apiKey,
      'APCA-API-SECRET-KEY': options.apiSecret,
    };

    const retryConfig: Parameters<typeof axiosRetry>[1] = {
      retries: Infinity,
      retryCondition: error => {
        // Alpaca Error Code 40310100 typically means your order was forbidden by Alpaca's system because it would trigger a Pattern Day Trader (PDT) violation.
        if (hasResponseCode(error) && error.response?.data.code === 40310100) {
          return false;
        }
        return axiosRetry.isNetworkError(error) || error.response?.status === 429;
      },
      retryDelay: retryCount => {
        return retryCount * 1_000;
      },
    };

    this.#tradingClient = axios.create({
      baseURL: options.usePaperTrading ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets',
      headers,
    });
    axiosRetry(this.#tradingClient, retryConfig);

    this.#marketDataClient = axios.create({
      baseURL: 'https://data.alpaca.markets',
      headers,
    });
    axiosRetry(this.#marketDataClient, retryConfig);
  }

  async getClock() {
    const response = await this.#tradingClient.get('/v2/clock');
    return ClockSchema.parse(response.data);
  }

  async getStockBarsLatest(params: {feed: string; symbols: string}) {
    const response = await this.#marketDataClient.get('/v2/stocks/bars/latest', {params});
    return LatestBarsResponseSchema.parse(response.data);
  }

  async getCryptoBarsLatest(params: {symbols: string}) {
    const response = await this.#marketDataClient.get('/v1beta3/crypto/us/latest/bars', {params});
    return LatestBarsResponseSchema.parse(response.data);
  }

  async getStockBars(params: {
    end: string;
    feed: string;
    limit: number;
    page_token?: string;
    start: string;
    symbols: string;
    timeframe: string;
  }) {
    const response = await this.#marketDataClient.get('/v2/stocks/bars', {params});
    return BarsResponseSchema.parse(response.data);
  }

  async getCryptoBars(params: {
    end: string;
    limit: number;
    page_token?: string;
    start: string;
    symbols: string;
    timeframe: string;
  }) {
    const response = await this.#marketDataClient.get('/v1beta3/crypto/us/bars', {params});
    return BarsResponseSchema.parse(response.data);
  }
}
