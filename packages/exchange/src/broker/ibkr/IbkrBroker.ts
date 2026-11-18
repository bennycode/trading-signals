import Big from 'big.js';
import {ms} from 'ms';
import {
  Broker,
  type Balance,
  type Candle,
  type CandleImportRequest,
  type FeeRate,
  type Fill,
  type LimitOrderOptions,
  type MarketOrderOptions,
  type OrderOptions,
  type PendingLimitOrder,
  type PendingMarketOrder,
  type PendingOrder,
  type OrderType,
  type TradingRules,
} from '../Broker.js';
import type {MarketDataSource} from '../MarketDataSource.js';
import type {TradingPair} from '../TradingPair.js';
import {IbkrAPI} from './api/IbkrAPI.js';
import {IbkrTimeInForce} from './api/schema/OrderSchema.js';
import {IbkrBrokerMapper} from './IbkrBrokerMapper.js';
import {createFillTopicId, startIbkrFillWatcher} from './IbkrFillWatcher.js';
import {estimateIbkrFee} from './IbkrFeeEstimate.js';
import type {IbkrBrokerOptions} from './IbkrBrokerOptions.js';
import {verifyIbkrSession} from './IbkrSession.js';
import {submitIbkrOrder} from './IbkrOrderSubmission.js';
import {toIbkrTradingRules} from './IbkrTradingRules.js';
import {ibkrFeeRates} from './IbkrFees.js';
import {IbkrConidResolver} from './IbkrConidResolver.js';
import {IbkrMarketData} from './IbkrMarketData.js';

/**
 * Interactive Brokers, over the Web API served by the Client Portal Gateway.
 *
 * The gateway is a local process holding a logged-in session, so this class carries no
 * credentials — see {@link IbkrAPI}. Candles come from {@link IbkrMarketData}, which reads IBKR's
 * own history endpoint, unless another {@link MarketDataSource} is injected.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/getting-started
 */
export class IbkrBroker extends Broker implements MarketDataSource {
  static readonly NAME = 'InteractiveBrokers';

  /** IBKR's smallest documented bar for the history endpoint. */
  static readonly SMALLEST_INTERVAL_MS = ms('1m');

  /** `getOpenOrders` polls this often when watching for fills. */
  static readonly ORDER_POLL_INTERVAL_MS = 5_000;

  readonly #api: IbkrAPI;
  readonly #overnight: boolean;
  readonly #timeInForce: typeof IbkrTimeInForce.DAY | typeof IbkrTimeInForce.GTC;
  readonly #marketData: MarketDataSource;
  readonly #conids: IbkrConidResolver;
  readonly #currencyByConid = new Map<number, string>();
  readonly #orderWatchers = new Map<string, NodeJS.Timeout>();
  readonly #candleListenerByTopic = new Map<string, (candle: unknown) => void>();
  #accountId?: string;
  #accountCurrency?: string;

  constructor(options?: IbkrBrokerOptions) {
    super(IbkrBroker.NAME);
    this.#api = new IbkrAPI({gatewayUrl: options?.gatewayUrl});
    this.#conids = new IbkrConidResolver(this.#api);
    this.#marketData = options?.marketData ?? new IbkrMarketData({api: this.#api, conids: this.#conids});
    this.#overnight = options?.overnight ?? false;
    this.#timeInForce = options?.timeInForce ?? IbkrTimeInForce.GTC;
    this.#accountId = options?.accountId;
  }

  get api(): IbkrAPI {
    return this.#api;
  }

  getName(): string {
    return IbkrBroker.NAME;
  }

  getSmallestInterval(): number {
    return IbkrBroker.SMALLEST_INTERVAL_MS;
  }

  /**
   * The gateway exposes no server clock, so this never leaves the process — which is why
   * {@link verifyCredentials} is overridden rather than relying on the inherited probe.
   */
  async getTime(): Promise<string> {
    return new Date().toISOString();
  }

  /**
   * Confirms the gateway holds a usable session, since this broker carries no credentials.
   *
   * @see {@link verifyIbkrSession}
   */
  override async verifyCredentials(): Promise<void> {
    return verifyIbkrSession(this.#api, () => this.getAccountId());
  }

  /**
   * The account every call is scoped to. Discovered once from the gateway when the caller did not
   * name one, because a session already knows which account it serves.
   */
  async getAccountId(): Promise<string> {
    if (this.#accountId) {
      return this.#accountId;
    }

    const accounts = await this.#api.getAccounts();
    const accountId = accounts.selectedAccount ?? accounts.accounts[0];

    if (!accountId) {
      throw new Error('The IBKR session reports no accounts.');
    }

    this.#accountId = accountId;
    return accountId;
  }

  /**
   * The currency the account settles in, which is where a trade's funds come from but is *not*
   * what fees are denominated in — IBKR bills a US stock in USD from a EUR account, so fees follow
   * `pair.counter`. Cached because it never changes.
   */
  async #getAccountCurrency(): Promise<string | undefined> {
    if (this.#accountCurrency) {
      return this.#accountCurrency;
    }

    const accountId = await this.getAccountId();
    const accounts = await this.#api.getPortfolioAccounts().catch(() => []);
    const currency = accounts.find(account => account.id === accountId)?.currency;

    if (currency) {
      this.#accountCurrency = currency;
    }

    return currency ?? undefined;
  }

  /** Resolves a ticker to IBKR's numeric contract id, which every other endpoint is keyed by. */
  async getConid(pair: TradingPair): Promise<number> {
    return this.#conids.getConid(pair);
  }

  /**
   * The currency an instrument quotes in, which a trade payload does not carry. Needed to build
   * the `TradingPair` on a streamed fill: guessing the account currency would mislabel every US
   * instrument held in a EUR account. Cached per contract, since it never changes.
   */
  async #getQuoteCurrency(conid: string | number | null | undefined): Promise<string> {
    const fallback = (await this.#getAccountCurrency()) ?? 'USD';

    if (conid === null || conid === undefined) {
      return fallback;
    }

    const key = Number(conid);
    const cached = this.#currencyByConid.get(key);
    if (cached) {
      return cached;
    }

    const info = await this.#api.getContractInfoAndRules(key).catch(() => undefined);
    const currency = info?.currency ?? fallback;
    this.#currencyByConid.set(key, currency);
    return currency;
  }

  async listBalances(): Promise<Balance[]> {
    const accountId = await this.getAccountId();
    const [ledger, positions] = await Promise.all([this.#api.getLedger(accountId), this.#api.getPositions(accountId)]);
    return IbkrBrokerMapper.toBalances(ledger, positions);
  }

  async getOpenOrders(pair: TradingPair): Promise<PendingOrder[]> {
    const conid = await this.getConid(pair);
    const response = await this.#api.getLiveOrders();
    const orders = response.orders ?? [];

    return orders
      .filter(order => Number(order.conid) === conid && IbkrBrokerMapper.isLiveOrder(order))
      .map(order => IbkrBrokerMapper.toPendingOrder(order, pair))
      .filter((order): order is PendingOrder => order !== undefined);
  }

  async cancelOrderById(_pair: TradingPair, orderId: string): Promise<void> {
    const accountId = await this.getAccountId();
    await this.#api.cancelOrder(accountId, orderId);
  }

  async cancelOpenOrders(pair: TradingPair): Promise<string[]> {
    const openOrders = await this.getOpenOrders(pair);
    const cancelled: string[] = [];

    for (const order of openOrders) {
      await this.cancelOrderById(pair, order.id);
      cancelled.push(order.id);
    }

    return cancelled;
  }

  async getFills(pair: TradingPair): Promise<Fill[]> {
    const [conid, feeAsset, trades] = await Promise.all([
      this.getConid(pair),
      this.getFeeAsset(pair),
      this.#api.getTrades(),
    ]);

    return trades
      .filter(trade => Number(trade.conid) === conid)
      .map(trade => IbkrBrokerMapper.toFill(trade, pair, feeAsset))
      .filter((fill): fill is Fill => fill !== undefined)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * IBKR splits a single order into one trade per execution, so the fills are merged back into
   * one: quantity-weighted average price, summed size and summed commission.
   */
  async getFillByOrderId(pair: TradingPair, orderId: string): Promise<Fill | undefined> {
    const fills = (await this.getFills(pair)).filter(fill => fill.order_id === orderId);

    const first = fills[0];
    if (!first) {
      return undefined;
    }

    let size = new Big(0);
    let notional = new Big(0);
    let fee = new Big(0);

    for (const fill of fills) {
      const fillSize = new Big(fill.size);
      size = size.plus(fillSize);
      notional = notional.plus(fillSize.times(fill.price));
      fee = fee.plus(fill.fee);
    }

    return {
      ...first,
      // Oldest execution is the order's own timestamp; `getFills` sorts newest first.
      created_at: fills[fills.length - 1]?.created_at ?? first.created_at,
      fee: fee.toString(),
      price: size.gt(0) ? notional.div(size).toString() : first.price,
      size: size.toString(),
    };
  }

  async getTradingRules(pair: TradingPair): Promise<TradingRules> {
    const conid = await this.getConid(pair);
    const info = await this.#api.getContractInfoAndRules(conid);

    return toIbkrTradingRules(info, pair);
  }

  /**
   * IBKR's commission as a rate, which it is not. Prefer {@link estimateFee}.
   *
   * @see {@link ibkrFeeRates}
   */
  async getFeeRates(pair: TradingPair): Promise<FeeRate> {
    const candle = await this.#marketData.getLatestCandle(pair, IbkrBroker.SMALLEST_INTERVAL_MS);

    return ibkrFeeRates(new Big(candle.close));
  }

  /**
   * IBKR's Fixed schedule worked out locally, for when its own preview is unavailable — a
   * backtest has no session to ask.
   *
   * Billed per share, so the share count is recovered from the notional and the price. The result
   * is rounded up to whole cents, which is how IBKR bills: 1% of USD 11.50 is 0.115 and the
   * preview quotes 0.12.
   */

  /**
   * Asks IBKR what the order would cost, falling back to the schedule applied locally when there
   * is no session to ask.
   *
   * @see {@link estimateIbkrFee}
   */
  override async estimateFee(
    pair: TradingPair,
    /** Unused: IBKR bills the same commission whether the order is a limit or a market order. */
    _orderType: OrderType,
    notional: Big
  ): Promise<{commission: Big; currencyConversion: Big; total: Big; feeAsset: string}> {
    return estimateIbkrFee({
      api: this.#api,
      feeAsset: await this.getFeeAsset(pair),
      getAccountId: () => this.getAccountId(),
      getConid: target => this.getConid(target),
      getLatestClose: async () =>
        new Big((await this.#marketData.getLatestCandle(pair, IbkrBroker.SMALLEST_INTERVAL_MS)).close),
      notional,
      pair,
    });
  }

  /**
   * Places an order and sees the confirmation dialogue through.
   *
   * IBKR answers a submission with either an accepted order, a rejection, or one or more
   * confirmation prompts (market closed, size warnings, and so on) that must be answered before
   * the order exists at all. Each answer can raise a further prompt, so this loops, with a cap so
   * an unexpected prompt cannot spin forever.
   */
  protected async placeOrder(pair: TradingPair, options: LimitOrderOptions): Promise<PendingLimitOrder>;
  protected async placeOrder(pair: TradingPair, options: MarketOrderOptions): Promise<PendingMarketOrder>;
  protected async placeOrder(pair: TradingPair, options: OrderOptions): Promise<PendingOrder>;
  protected async placeOrder(pair: TradingPair, options: OrderOptions): Promise<PendingOrder> {
    const [accountId, conid] = await Promise.all([this.getAccountId(), this.getConid(pair)]);

    return submitIbkrOrder({
      accountId,
      api: this.#api,
      conid,
      options,
      overnight: this.#overnight,
      pair,
      timeInForce: this.#timeInForce,
    });
  }

  /**
   * Polls for executions and emits each new one.
   *
   * The Web API does offer a WebSocket, but it needs its own session handshake and re-subscribes
   * on every reconnect; polling the trades endpoint covers the same ground for a strategy that
   * places an order and waits for its fill. Only executions seen after subscribing are emitted,
   * so a fresh watcher does not replay the day's history as if it had just happened.
   */
  async watchOrders(): Promise<string> {
    const topicId = createFillTopicId();

    const timer = startIbkrFillWatcher({
      api: this.#api,
      emit: fill => this.emit(topicId, fill),
      getFeeAsset: pair => this.getFeeAsset(pair),
      getQuoteCurrency: conid => this.#getQuoteCurrency(conid),
      pollIntervalMs: IbkrBroker.ORDER_POLL_INTERVAL_MS,
    });

    this.#orderWatchers.set(topicId, timer);

    return topicId;
  }

  unwatchOrders(topicId: string): void {
    const timer = this.#orderWatchers.get(topicId);
    if (timer) {
      clearInterval(timer);
      this.#orderWatchers.delete(topicId);
    }
    this.removeAllListeners(topicId);
  }

  getCandles(pair: TradingPair, request: CandleImportRequest): Promise<Candle[]> {
    return this.#marketData.getCandles(pair, request);
  }

  getLatestCandle(pair: TradingPair, intervalInMillis: number): Promise<Candle> {
    return this.#marketData.getLatestCandle(pair, intervalInMillis);
  }

  getRecentCandles(pair: TradingPair, count: number, intervalInMillis: number): Promise<Candle[]> {
    return this.#marketData.getRecentCandles(pair, count, intervalInMillis);
  }

  async watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string> {
    const topicId = await this.#marketData.watchCandles(pair, intervalInMillis, openTimeInISO);

    // Re-emit on this instance so callers only ever listen to the broker they were handed.
    const listener = (candle: unknown) => this.emit(topicId, candle);
    this.#marketData.on(topicId, listener);
    this.#candleListenerByTopic.set(topicId, listener);

    return topicId;
  }

  unwatchCandles(topicId: string): void {
    const listener = this.#candleListenerByTopic.get(topicId);
    if (listener) {
      this.#marketData.off(topicId, listener);
      this.#candleListenerByTopic.delete(topicId);
    }
    this.#marketData.unwatchCandles(topicId);
    this.removeAllListeners(topicId);
  }

  /**
   * Closes what this broker owns. The injected market-data source is left alone: its lifecycle
   * belongs to whoever constructed it, which may be several brokers sharing one feed.
   */
  disconnect(): void {
    for (const topicId of this.#orderWatchers.keys()) {
      this.unwatchOrders(topicId);
    }
    for (const topicId of [...this.#candleListenerByTopic.keys()]) {
      this.unwatchCandles(topicId);
    }
  }
}
