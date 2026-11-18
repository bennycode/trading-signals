import axios, {type AxiosDefaults, type AxiosInstance} from 'axios';
import {Agent} from 'node:https';
import {z} from 'zod';
import {retry} from '../../../util/retry.js';
import {simplifyError} from '../../../util/simplifyError.js';
import {
  IbkrAccountsSchema,
  IbkrLedgerSchema,
  IbkrPortfolioAccountSchema,
  IbkrPositionSchema,
} from './schema/AccountSchema.js';
import {IbkrHistoryResponseSchema} from './schema/BarSchema.js';
import {IbkrContractInfoSchema, IbkrSecdefSearchResponseSchema} from './schema/ContractSchema.js';
import {
  IbkrLiveOrdersResponseSchema,
  IbkrOrderPreviewSchema,
  IbkrOrderSubmitResponseSchema,
  type IbkrOrderRequest,
} from './schema/OrderSchema.js';
import {IbkrAuthStatusSchema, IbkrTickleSchema} from './schema/SessionSchema.js';
import {IbkrTradesResponseSchema} from './schema/TradeSchema.js';

const URL = {
  ACCOUNTS: '/v1/api/iserver/accounts',
  AUTH_STATUS: '/v1/api/iserver/auth/status',
  CONTRACT_INFO_AND_RULES: '/v1/api/iserver/contract',
  LEDGER: '/v1/api/portfolio',
  MARKETDATA_HISTORY: '/v1/api/iserver/marketdata/history',
  ORDERS: '/v1/api/iserver/account/orders',
  PORTFOLIO_ACCOUNTS: '/v1/api/portfolio/accounts',
  REPLY: '/v1/api/iserver/reply',
  SECDEF_SEARCH: '/v1/api/iserver/secdef/search',
  SELECT_ACCOUNT: '/v1/api/iserver/account',
  SESSION_INIT: '/v1/api/iserver/auth/ssodh/init',
  TICKLE: '/v1/api/tickle',
  TRADES: '/v1/api/iserver/account/trades',
} as const;

/**
 * REST client for IBKR's Web API as served by the Client Portal Gateway.
 *
 * Unlike Alpaca and Trading212 there are no API keys: the gateway holds a browser-established
 * session and signs requests itself, so this client talks to it over plain HTTPS on localhost and
 * carries no credentials at all. That also means every call fails with 401 until somebody has
 * logged the gateway in — {@link getAuthStatus} is how the broker tells that apart from a real
 * failure.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/getting-started
 */
export class IbkrAPI {
  static readonly URL = URL;

  /**
   * The gateway's default address, which is where `root/conf.yaml` in IBKR's own distribution
   * listens (`listenPort: 5001`). It serves HTTPS with a self-signed certificate.
   *
   * The launcher and the `gateway:ibkr:status` script read the port from here, so a gateway
   * configured onto another port only has to be named once.
   */
  static readonly URL_GATEWAY = 'https://localhost:5001';

  readonly #httpClient: AxiosInstance;

  /**
   * Whether a gateway address is this machine, and so reachable without crossing a network where
   * a certificate would be the only thing proving who answered.
   */
  static isLoopback(gatewayUrl: string): boolean {
    try {
      // `globalThis.URL` because this module's own `URL` constant of endpoint paths shadows it.
      const {hostname} = new globalThis.URL(gatewayUrl);
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
    } catch {
      // An address that will not parse is not one that can be shown to be local.
      return false;
    }
  }

  constructor(options?: {
    gatewayUrl?: string;
    /**
     * Held off until this resolves, when something is bringing the gateway up.
     *
     * One interceptor rather than a check in every method: without it a credentials-only client
     * answers its first calls with 401s while the login is still in flight, which reads as bad
     * credentials rather than "not ready yet". Whatever brings the gateway up must use a client
     * without this, or it waits on itself.
     */
    waitForSession?: () => Promise<void>;
  }) {
    const gatewayUrl = options?.gatewayUrl ?? IbkrAPI.URL_GATEWAY;

    this.#httpClient = axios.create({
      baseURL: gatewayUrl,
      /*
       * The gateway generates its own certificate for `localhost`, so a loopback connection has no
       * chain to verify against and verification has to be off. Anywhere else it stays on: a
       * remote gateway crosses a network, and skipping verification there would leave the session
       * open to anyone able to answer in its place. Scoped to this client rather than set
       * process-wide, which would disable verification for every other broker too.
       */
      httpsAgent: new Agent({rejectUnauthorized: !IbkrAPI.isLoopback(gatewayUrl)}),
    });

    const waitForSession = options?.waitForSession;
    if (waitForSession) {
      this.#httpClient.interceptors.request.use(async config => {
        await waitForSession();
        return config;
      });
    }

    simplifyError(this.#httpClient);
  }

  get defaults(): AxiosDefaults {
    return this.#httpClient.defaults;
  }

  get interceptors() {
    return this.#httpClient.interceptors;
  }

  /** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/trading-session */
  @retry({retries: 2})
  async getAuthStatus() {
    const response = await this.#httpClient.get(URL.AUTH_STATUS);
    return IbkrAuthStatusSchema.parse(response.data);
  }

  /**
   * Opens the brokerage session that every `/iserver` endpoint requires. Safe to call when one is
   * already open, which is why the broker does it unconditionally at startup.
   *
   * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/trading-session
   */
  @retry({retries: 2})
  async initSession() {
    const response = await this.#httpClient.post(URL.SESSION_INIT, {compete: true, publish: true});
    return IbkrAuthStatusSchema.parse(response.data);
  }

  /**
   * Keeps the session from lapsing. The gateway launcher does this too, but a
   * directly-launched gateway has nobody else to do it.
   *
   * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/trading-session
   */
  @retry({retries: 2})
  async tickle() {
    const response = await this.#httpClient.post(URL.TICKLE);
    return IbkrTickleSchema.parse(response.data);
  }

  /** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/accounts */
  @retry()
  async getAccounts() {
    const response = await this.#httpClient.get(URL.ACCOUNTS);
    return IbkrAccountsSchema.parse(response.data);
  }

  /**
   * Makes an account the session's current one.
   *
   * Order monitoring reads whichever account is selected rather than taking one as a parameter,
   * so a session left on another account reports that account's orders.
   *
   * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/accounts
   */
  @retry({retries: 1})
  async selectAccount(accountId: string): Promise<void> {
    await this.#httpClient.post(URL.SELECT_ACCOUNT, {acctId: accountId});
  }

  /** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/portfolio */
  @retry()
  async getPortfolioAccounts() {
    const response = await this.#httpClient.get(URL.PORTFOLIO_ACCOUNTS);
    return z.array(IbkrPortfolioAccountSchema).parse(response.data);
  }

  /** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/portfolio */
  @retry()
  async getLedger(accountId: string) {
    const response = await this.#httpClient.get(`${URL.LEDGER}/${accountId}/ledger`);
    return IbkrLedgerSchema.parse(response.data);
  }

  /**
   * One page of open positions. IBKR pages these at 30 rows, and `pageId` is zero-based.
   *
   * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/portfolio
   */
  @retry()
  async getPositions(accountId: string, pageId = 0) {
    const response = await this.#httpClient.get(`${URL.LEDGER}/${accountId}/positions/${pageId}`);
    return z.array(IbkrPositionSchema).parse(response.data);
  }

  /** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/contracts */
  @retry()
  async searchContracts(symbol: string, secType = 'STK') {
    const response = await this.#httpClient.get(URL.SECDEF_SEARCH, {params: {secType, symbol}});
    return IbkrSecdefSearchResponseSchema.parse(response.data);
  }

  /** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/contracts */
  @retry()
  async getContractInfoAndRules(conid: number) {
    const response = await this.#httpClient.get(`${URL.CONTRACT_INFO_AND_RULES}/${conid}/info-and-rules`);
    return IbkrContractInfoSchema.parse(response.data);
  }

  /** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/order-management */
  @retry()
  async getLiveOrders(filters?: string) {
    const response = await this.#httpClient.get(URL.ORDERS, {
      params: filters ? {filters} : undefined,
    });
    return IbkrLiveOrdersResponseSchema.parse(response.data);
  }

  /** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/order-management */
  @retry()
  async getTrades() {
    const response = await this.#httpClient.get(URL.TRADES);
    return IbkrTradesResponseSchema.parse(response.data);
  }

  /**
   * Submits one or more orders. The 200 response is a union: an accepted order, a confirmation
   * prompt to answer via {@link replyToOrderMessage}, or a rejection — see
   * {@link IbkrOrderSubmitResponseSchema}.
   *
   * Deliberately not retried: a resubmission after a timeout could double-fill. The caller passes
   * `cOID` so a failed attempt can be reconciled instead.
   *
   * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/order-management
   */
  async submitOrder(accountId: string, order: IbkrOrderRequest) {
    const response = await this.#httpClient.post(`/v1/api/iserver/account/${accountId}/orders`, {
      orders: [order],
    });
    return IbkrOrderSubmitResponseSchema.parse(response.data);
  }

  /**
   * Answers a confirmation prompt raised by a submission. Also not retried, for the same reason.
   *
   * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/order-management
   */
  async replyToOrderMessage(replyId: string, confirmed: boolean) {
    const response = await this.#httpClient.post(`${URL.REPLY}/${replyId}`, {confirmed});
    return IbkrOrderSubmitResponseSchema.parse(response.data);
  }

  /**
   * Prices an order without placing it, which is where `commission` comes from.
   *
   * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/order-management
   */
  @retry({retries: 1})
  async previewOrder(accountId: string, order: IbkrOrderRequest) {
    const response = await this.#httpClient.post(`/v1/api/iserver/account/${accountId}/orders/whatif`, {
      orders: [order],
    });
    return IbkrOrderPreviewSchema.parse(response.data);
  }

  /** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/order-management */
  @retry()
  async cancelOrder(accountId: string, orderId: string): Promise<void> {
    await this.#httpClient.delete(`/v1/api/iserver/account/${accountId}/order/${orderId}`);
  }

  /**
   * Historical bars.
   *
   * @param period - How far back to go, e.g. `1d`, `2w`, `6m`.
   * @param bar - Bar size, e.g. `1min`, `1h`, `1d`.
   * @param startTime - Anchor in IBKR's `YYYYMMDD-HH:mm:ss` UTC format; the window ends here.
   * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/market-data
   */
  @retry()
  async getHistory(options: {bar: string; conid: number; outsideRth?: boolean; period: string; startTime?: string}) {
    const response = await this.#httpClient.get(URL.MARKETDATA_HISTORY, {
      params: {
        bar: options.bar,
        conid: options.conid,
        outsideRth: options.outsideRth ?? false,
        period: options.period,
        ...(options.startTime ? {startTime: options.startTime} : {}),
      },
    });
    return IbkrHistoryResponseSchema.parse(response.data);
  }
}
