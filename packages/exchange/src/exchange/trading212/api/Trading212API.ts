import axios, {type AxiosDefaults, type AxiosError, type AxiosInstance} from 'axios';
import axiosRetry from 'axios-retry';
import {z} from 'zod';
import {AccountCashSchema, AccountInfoSchema} from './schema/AccountSchema.js';
import {HistoryOrderPageSchema, type HistoryOrder} from './schema/HistoryOrderSchema.js';
import {InstrumentSchema} from './schema/InstrumentSchema.js';
import {
  OrderSchema,
  PlaceLimitOrderRequestSchema,
  PlaceMarketOrderRequestSchema,
  type PlaceLimitOrderRequest,
  type PlaceMarketOrderRequest,
} from './schema/OrderSchema.js';
import {PositionSchema} from './schema/PositionSchema.js';

const URL = {
  ACCOUNT_CASH: '/api/v0/equity/account/cash',
  ACCOUNT_INFO: '/api/v0/equity/account/info',
  HISTORY_ORDERS: '/api/v0/equity/history/orders',
  METADATA_INSTRUMENTS: '/api/v0/equity/metadata/instruments',
  ORDERS: '/api/v0/equity/orders',
  ORDERS_LIMIT: '/api/v0/equity/orders/limit',
  ORDERS_MARKET: '/api/v0/equity/orders/market',
  PORTFOLIO: '/api/v0/equity/portfolio',
} as const;

/**
 * Per-endpoint retry delays (ms) calibrated to Trading212's documented rate limits.
 *
 * @see https://t212public-api-docs.redoc.ly/
 */
function getRetryDelay(retryCount: number, error: AxiosError): number {
  const url = error.config?.url ?? '';
  const method = error.config?.method;

  if (method === 'get' && url.startsWith(`${URL.ORDERS}/`)) {
    return 1_000;
  }

  switch (url) {
    case URL.ACCOUNT_CASH:
      return 2_000;
    case URL.ORDERS:
    case URL.PORTFOLIO:
      return 5_000;
    case URL.ACCOUNT_INFO:
      return 30_000;
    case URL.METADATA_INSTRUMENTS:
      return 50_000;
    case URL.HISTORY_ORDERS:
      return 60_000;
    default:
      return retryCount * 1_000;
  }
}

export class Trading212API {
  static readonly URL = URL;

  static readonly URL_LIVE = 'https://live.trading212.com';
  static readonly URL_DEMO = 'https://demo.trading212.com';

  readonly #httpClient: AxiosInstance;

  constructor(options: {apiKey: string; usePaperTrading: boolean}) {
    this.#httpClient = axios.create({
      baseURL: options.usePaperTrading ? Trading212API.URL_DEMO : Trading212API.URL_LIVE,
    });

    this.#httpClient.interceptors.request.use(config => {
      config.headers.set('Authorization', options.apiKey);
      return config;
    });

    axiosRetry(this.#httpClient, {
      retries: Infinity,
      retryCondition: (error: AxiosError) => {
        return axiosRetry.isNetworkError(error) || error.response?.status === 429 || error.code === 'EAI_AGAIN';
      },
      retryDelay: getRetryDelay,
    });
  }

  get defaults(): AxiosDefaults {
    return this.#httpClient.defaults;
  }

  get interceptors() {
    return this.#httpClient.interceptors;
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/accountCash */
  async getAccountCash() {
    const response = await this.#httpClient.get(URL.ACCOUNT_CASH);
    return AccountCashSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/account */
  async getAccountInfo() {
    const response = await this.#httpClient.get(URL.ACCOUNT_INFO);
    return AccountInfoSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/portfolio */
  async getPositions() {
    const response = await this.#httpClient.get(URL.PORTFOLIO);
    return z.array(PositionSchema).parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/positionByTicker */
  async getPositionByTicker(ticker: string) {
    const response = await this.#httpClient.get(`${URL.PORTFOLIO}/${ticker}`);
    return PositionSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/orders */
  async getOrders() {
    const response = await this.#httpClient.get(URL.ORDERS);
    return z.array(OrderSchema).parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/orderById */
  async getOrderById(id: number) {
    const response = await this.#httpClient.get(`${URL.ORDERS}/${id}`);
    return OrderSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/cancelOrder */
  async cancelOrder(id: number): Promise<void> {
    await this.#httpClient.delete(`${URL.ORDERS}/${id}`);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/placeMarketOrder */
  async placeMarketOrder(request: PlaceMarketOrderRequest) {
    const validated = PlaceMarketOrderRequestSchema.parse(request);
    const response = await this.#httpClient.post(URL.ORDERS_MARKET, validated);
    return OrderSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/placeLimitOrder */
  async placeLimitOrder(request: PlaceLimitOrderRequest) {
    const validated = PlaceLimitOrderRequestSchema.parse(request);
    const response = await this.#httpClient.post(URL.ORDERS_LIMIT, validated);
    return OrderSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/instruments */
  async getInstruments() {
    const response = await this.#httpClient.get(URL.METADATA_INSTRUMENTS);
    return z.array(InstrumentSchema).parse(response.data);
  }

  /**
   * Fetches all historical orders (auto-paginates via `nextPagePath`).
   *
   * @see https://t212public-api-docs.redoc.ly/#operation/orders_1
   */
  async getHistoryOrders(ticker?: string): Promise<HistoryOrder[]> {
    const items: HistoryOrder[] = [];
    let nextPath: string | null = null;
    const params: Record<string, string> = {limit: '50'};
    if (ticker) {
      params.ticker = ticker;
    }

    do {
      const response = nextPath
        ? await this.#httpClient.get(nextPath)
        : await this.#httpClient.get(URL.HISTORY_ORDERS, {params});
      const page = HistoryOrderPageSchema.parse(response.data);
      items.push(...page.items);
      nextPath = page.nextPagePath;
    } while (nextPath);

    return items;
  }
}
