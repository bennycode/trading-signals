import axios, {type AxiosDefaults, type AxiosInstance} from 'axios';
import {z} from 'zod';
import {retry} from '../../../util/retry.js';
import {simplifyError} from '../../../util/simplifyError.js';
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
 * The `@retry` delay on each method is calibrated to Trading212's documented rate limit
 * for that endpoint.
 *
 * @see https://t212public-api-docs.redoc.ly/
 */
export class Trading212API {
  static readonly URL = URL;

  static readonly URL_LIVE = 'https://live.trading212.com';
  static readonly URL_DEMO = 'https://demo.trading212.com';

  readonly #httpClient: AxiosInstance;

  constructor(options: {apiKey: string; apiSecret: string; usePaperTrading: boolean}) {
    this.#httpClient = axios.create({
      baseURL: options.usePaperTrading ? Trading212API.URL_DEMO : Trading212API.URL_LIVE,
    });

    const credentials = Buffer.from(`${options.apiKey}:${options.apiSecret}`).toString('base64');

    this.#httpClient.interceptors.request.use(config => {
      config.headers.set('Authorization', `Basic ${credentials}`);
      return config;
    });

    simplifyError(this.#httpClient);
  }

  get defaults(): AxiosDefaults {
    return this.#httpClient.defaults;
  }

  get interceptors() {
    return this.#httpClient.interceptors;
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/accountCash */
  @retry({delayMs: 2_000})
  async getAccountCash() {
    const response = await this.#httpClient.get(URL.ACCOUNT_CASH);
    return AccountCashSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/account */
  @retry({delayMs: 30_000})
  async getAccountInfo() {
    const response = await this.#httpClient.get(URL.ACCOUNT_INFO);
    return AccountInfoSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/portfolio */
  @retry({delayMs: 5_000})
  async getPositions() {
    const response = await this.#httpClient.get(URL.PORTFOLIO);
    return z.array(PositionSchema).parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/positionByTicker */
  @retry()
  async getPositionByTicker(ticker: string) {
    const response = await this.#httpClient.get(`${URL.PORTFOLIO}/${ticker}`);
    return PositionSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/orders */
  @retry({delayMs: 5_000})
  async getOrders() {
    const response = await this.#httpClient.get(URL.ORDERS);
    return z.array(OrderSchema).parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/orderById */
  @retry({delayMs: 1_000})
  async getOrderById(id: number) {
    const response = await this.#httpClient.get(`${URL.ORDERS}/${id}`);
    return OrderSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/cancelOrder */
  @retry()
  async cancelOrder(id: number): Promise<void> {
    await this.#httpClient.delete(`${URL.ORDERS}/${id}`);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/placeMarketOrder */
  @retry()
  async placeMarketOrder(request: PlaceMarketOrderRequest) {
    const validated = PlaceMarketOrderRequestSchema.parse(request);
    const response = await this.#httpClient.post(URL.ORDERS_MARKET, validated);
    return OrderSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/placeLimitOrder */
  @retry()
  async placeLimitOrder(request: PlaceLimitOrderRequest) {
    const validated = PlaceLimitOrderRequestSchema.parse(request);
    const response = await this.#httpClient.post(URL.ORDERS_LIMIT, validated);
    return OrderSchema.parse(response.data);
  }

  /** @see https://t212public-api-docs.redoc.ly/#operation/instruments */
  @retry({delayMs: 50_000})
  async getInstruments() {
    const response = await this.#httpClient.get(URL.METADATA_INSTRUMENTS);
    return z.array(InstrumentSchema).parse(response.data);
  }

  /**
   * Fetches a single page of historical orders. Used by the polling order watcher to avoid
   * re-downloading the entire history every tick. Pass a `nextPath` (from a previous page's
   * `nextPagePath`) to continue paging.
   *
   * @see https://t212public-api-docs.redoc.ly/#operation/orders_1
   */
  @retry({delayMs: 60_000})
  async getHistoryOrdersPage(options?: {nextPath?: string; ticker?: string}) {
    if (options?.nextPath) {
      const response = await this.#httpClient.get(options.nextPath);
      return HistoryOrderPageSchema.parse(response.data);
    }
    const params: Record<string, string> = {limit: '50'};
    if (options?.ticker) {
      params.ticker = options.ticker;
    }
    const response = await this.#httpClient.get(URL.HISTORY_ORDERS, {params});
    return HistoryOrderPageSchema.parse(response.data);
  }

  /**
   * Fetches all historical orders (auto-paginates via `nextPagePath`). Deliberately not decorated
   * with `@retry` — each page is fetched through {@link getHistoryOrdersPage}, so a transient
   * failure retries only the affected page instead of restarting the whole pagination.
   *
   * @see https://t212public-api-docs.redoc.ly/#operation/orders_1
   */
  async getHistoryOrders(ticker?: string): Promise<HistoryOrder[]> {
    const items: HistoryOrder[] = [];
    let nextPath: string | undefined = undefined;

    do {
      const page = await this.getHistoryOrdersPage({nextPath, ticker});
      items.push(...page.items);
      nextPath = page.nextPagePath ?? undefined;
    } while (nextPath);

    return items;
  }
}
