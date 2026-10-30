import axios, {type AxiosError} from 'axios';
import axiosRetry from 'axios-retry';
import {ms} from 'ms';
import {AccountSchema} from './schema/AccountSchema.js';
import {AssetSchema} from './schema/AssetSchema.js';
import {BarsResponseSchema, LatestBarsResponseSchema} from './schema/BarSchema.js';
import {ClockSchema} from './schema/ClockSchema.js';
import {OrderSchema, type AlpacaAssetClass} from './schema/OrderSchema.js';
import {PositionSchema} from './schema/PositionSchema.js';
import {simplifyError} from '../../../util/simplifyError.js';
import {SnapshotsResponseSchema} from './schema/SnapshotSchema.js';
import {z} from 'zod';

function hasResponseCode(error: AxiosError): error is AxiosError<{code: number}> {
  const data = error.response?.data;
  return !!data && typeof data === 'object' && 'code' in data && typeof data.code === 'number';
}

/**
 * Alpaca Error Code 40310100 meant the order was forbidden because it would trigger a
 * Pattern Day Trader (PDT) violation. FINRA retired the PDT rule on 2026-06-04 in favour of
 * an intraday margin framework, so this rejection should no longer occur for that reason.
 * The check is kept because Alpaca may still return the code.
 *
 * @see https://alpaca.markets/blog/finra-retires-the-pdt-rule-introducing-alpacas-new-intraday-margin-framework/
 */
function isPatternDayTrader(error: AxiosError) {
  return hasResponseCode(error) && error.response?.data.code === 40310100;
}

/**
 * Alpaca Error Code 40310000 means the account is not allowed to short (you must have
 * $2,000 or more account equity.).
 *
 * @see https://docs.alpaca.markets/us/docs/margin-and-short-selling
 */
function isNotAllowedToShort(error: AxiosError) {
  return hasResponseCode(error) && error.response?.data.code === 40310000;
}

export function shouldRetryAlpacaRequest(error: AxiosError) {
  if (isPatternDayTrader(error)) {
    return false;
  }
  if (isNotAllowedToShort(error)) {
    return false;
  }
  return axiosRetry.isRetryableError(error);
}

interface PostOrderRequestBase {
  client_order_id: string;
  /** Alpaca honours this for limit orders only. */
  extended_hours?: boolean;
  limit_price?: string;
  notional?: string;
  /**
   * Number of shares. A stop order takes a fractional quantity only alongside `day` validity; with
   * `gtc` Alpaca answers "stop/stop_limit fractional GTC orders are not enabled". This is the same
   * day-for-fractional rule `AlpacaBrokerMapper.toOrderRequest` already applies to market and limit
   * orders.
   *
   * @see https://docs.alpaca.markets/docs/fractional-trading
   */
  qty?: string;
  side: string;
  symbol: string;
  /** A stop order takes `day` or `gtc` only; Alpaca rejects the other values outright. */
  time_in_force: string;
}

/**
 * `stop_price` is what turns an order into a stop, and Alpaca rejects the pairing either way
 * round, so the two travel together rather than as two independent optional fields.
 */
export type PostOrderRequest = PostOrderRequestBase &
  ({type: 'market' | 'limit'; stop_price?: never} | {type: 'stop' | 'stop_limit'; stop_price: string});

/**
 * Alpaca replaces an order in one call, so a resting order never leaves the venue. Only the fields
 * being changed are sent; `qty` and `notional` are mutually exclusive, and a non-IPO notional order
 * cannot be replaced at all.
 *
 * @see https://docs.alpaca.markets/reference/patchorderbyorderid
 */
export interface PatchOrderRequest {
  limit_price?: string;
  qty?: string;
  stop_price?: string;
  time_in_force?: string;
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
      retries: 20,
      retryCondition: shouldRetryAlpacaRequest,
      retryDelay: retryCount => {
        return retryCount * ms('1s');
      },
    };

    this.#tradingClient = axios.create({
      baseURL: options.usePaperTrading ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets',
      headers,
    });
    axiosRetry(this.#tradingClient, retryConfig);
    simplifyError(this.#tradingClient);

    /*
     * Paper and live accounts read market data from the same host. The sandbox data host is for
     * Broker API partners and rejects Trading API keys with a 401.
     * @see https://docs.alpaca.markets/us/docs/historical-api
     */
    this.#marketDataClient = axios.create({
      baseURL: 'https://data.alpaca.markets',
      headers,
    });
    axiosRetry(this.#marketDataClient, retryConfig);
    simplifyError(this.#marketDataClient);
  }

  /** @see https://docs.alpaca.markets/reference/get-v2-clock */
  async getClock() {
    const response = await this.#tradingClient.get('/v2/clock');
    return ClockSchema.parse(response.data);
  }

  /** @see https://docs.alpaca.markets/reference/stocklatestbars */
  async getStockBarsLatest(params: {feed?: string; symbols: string}) {
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
    feed?: string;
    limit: number;
    page_token?: string;
    start: string;
    symbols: string;
    timeframe: string;
  }) {
    const response = await this.#marketDataClient.get('/v2/stocks/bars', {params});
    return BarsResponseSchema.parse(response.data);
  }

  /** @see https://docs.alpaca.markets/reference/stocksnapshots-1 */
  async getStockSnapshots(params: {feed?: string; symbols: string}) {
    const response = await this.#marketDataClient.get('/v2/stocks/snapshots', {params});
    return SnapshotsResponseSchema.parse(response.data);
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

  /**
   * @see https://docs.alpaca.markets/reference/postorder
   * @see https://docs.alpaca.markets/us/docs/working-with-orders#using-client-order-ids
   */
  async postOrder(params: PostOrderRequest) {
    const response = await this.#tradingClient.post('/v2/orders', params);
    return OrderSchema.parse(response.data);
  }

  /**
   * Replaces a resting order, returning it under a new ID. Atomic, so unlike a cancel followed by a
   * fresh order there is no window in which the venue holds nothing.
   *
   * @see https://docs.alpaca.markets/reference/patchorderbyorderid
   */
  async patchOrder(orderId: string, params: PatchOrderRequest) {
    const response = await this.#tradingClient.patch(`/v2/orders/${orderId}`, params);
    return OrderSchema.parse(response.data);
  }

  /** @see https://docs.alpaca.markets/reference/get-v2-assets */
  async getAssets(params: {asset_class: AlpacaAssetClass}) {
    const response = await this.#tradingClient.get('/v2/assets', {params});
    return z.array(AssetSchema).parse(response.data);
  }
}
