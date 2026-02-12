import axios, {type AxiosError} from 'axios';
import axiosRetry from 'axios-retry';
import {AccountSchema} from './schema/AccountSchema.js';
import {AssetSchema} from './schema/AssetSchema.js';
import {BarsResponseSchema, LatestBarsResponseSchema} from './schema/BarSchema.js';
import {ClockSchema} from './schema/ClockSchema.js';
import {OrderSchema} from './schema/OrderSchema.js';
import {PositionSchema} from './schema/PositionSchema.js';
import {z} from 'zod';

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

    // Market data is read-only — paper trading keys authenticate against the production data endpoint.
    // The sandbox data endpoint (data.sandbox.alpaca.markets) requires separate sandbox-specific credentials.
    this.#marketDataClient = axios.create({
      baseURL: 'https://data.alpaca.markets',
      headers,
    });
    axiosRetry(this.#marketDataClient, retryConfig);
  }

  /** @see https://docs.alpaca.markets/reference/get-v2-clock */
  async getClock() {
    const response = await this.#tradingClient.get('/v2/clock');
    return ClockSchema.parse(response.data);
  }

  /** @see https://docs.alpaca.markets/reference/stocklatestbars */
  async getStockBarsLatest(params: {feed: string; symbols: string}) {
    const response = await this.#marketDataClient.get('/v2/stocks/bars/latest', {params});
    return LatestBarsResponseSchema.parse(response.data);
  }

  /** @see https://docs.alpaca.markets/reference/cryptolatestbars */
  async getCryptoBarsLatest(params: {symbols: string}) {
    const response = await this.#marketDataClient.get('/v1beta3/crypto/us/latest/bars', {params});
    return LatestBarsResponseSchema.parse(response.data);
  }

  /** @see https://docs.alpaca.markets/reference/stockbars */
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

  /** @see https://docs.alpaca.markets/reference/cryptobars-1 */
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

  /** @see https://docs.alpaca.markets/reference/getaccount-1 */
  async getAccount() {
    const response = await this.#tradingClient.get('/v2/account');
    return AccountSchema.parse(response.data);
  }

  /** @see https://docs.alpaca.markets/reference/getallopenpositions */
  async getPositions() {
    const response = await this.#tradingClient.get('/v2/positions');
    return z.array(PositionSchema).parse(response.data);
  }

  /** @see https://docs.alpaca.markets/reference/getallorders */
  async getOrders(params: {status: string; symbols?: string}) {
    const response = await this.#tradingClient.get('/v2/orders', {params});
    return z.array(OrderSchema).parse(response.data);
  }

  /** @see https://docs.alpaca.markets/reference/deleteorderbyorderid */
  async deleteOrder(orderId: string) {
    await this.#tradingClient.delete(`/v2/orders/${orderId}`);
  }

  /** @see https://docs.alpaca.markets/reference/postorder */
  async postOrder(params: {
    extended_hours?: boolean;
    limit_price?: string;
    notional?: string;
    qty?: string;
    side: string;
    symbol: string;
    time_in_force: string;
    type: string;
  }) {
    const response = await this.#tradingClient.post('/v2/orders', params);
    return OrderSchema.parse(response.data);
  }

  /** @see https://docs.alpaca.markets/reference/get-v2-assets */
  async getAssets(params: {asset_class: string}) {
    const response = await this.#tradingClient.get('/v2/assets', {params});
    return z.array(AssetSchema).parse(response.data);
  }
}
