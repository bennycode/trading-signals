import Big from 'big.js';
import {ms} from 'ms';
import {
  Broker,
  type Balance,
  type Candle,
  type CandleImportRequest,
  type ExchangeAvailableBalance,
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
import type {CandleFeed, MarketDataSource} from '../MarketDataSource.js';
import type {TradingPair} from '../TradingPair.js';
import {IbkrAPI} from './api/IbkrAPI.js';
import {IbkrTimeInForce} from './api/schema/OrderSchema.js';
import {IbkrBrokerMapper} from './IbkrBrokerMapper.js';
import type {IbkrGatewayLauncher} from './gateway/IbkrGatewayLauncher.js';
import {IbkrGatewayStage, type IbkrGatewayState} from './gateway/IbkrGatewayState.js';
import {resolveIbkrAccountId} from './IbkrAccountSelection.js';
import {toAvailableCash} from './IbkrCashConversion.js';
import {IbkrCurrencyResolver} from './IbkrCurrencyResolver.js';
import {createFillTopicId, mergeFills, startIbkrFillWatcher, type IbkrFillWatcher} from './IbkrFillWatcher.js';
import {getCompleteIbkrLiveOrders, isIbkrOrderWorking} from './IbkrLiveOrders.js';
import {getAllIbkrPositions} from './IbkrPortfolio.js';
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
export class IbkrBroker extends Broker implements CandleFeed {
  static readonly NAME = 'InteractiveBrokers';

  /** IBKR's smallest documented bar for the history endpoint. */
  static readonly SMALLEST_INTERVAL_MS = ms('1m');

  /** `getOpenOrders` polls this often when watching for fills. */
  static readonly ORDER_POLL_INTERVAL_MS = 5_000;

  readonly #api: IbkrAPI;
  /** Resolved on first use, so the launcher's `node:child_process` stays off the static graph. */
  #gatewayPromise?: Promise<IbkrGatewayLauncher> | undefined;
  #gatewayState?: IbkrGatewayState | undefined;
  readonly #credentials?: IbkrBrokerOptions | undefined;
  readonly #overnight: boolean;
  readonly #timeInForce: typeof IbkrTimeInForce.DAY | typeof IbkrTimeInForce.GTC;
  readonly #marketData: MarketDataSource;
  readonly #conids: IbkrConidResolver;
  readonly #currencies: IbkrCurrencyResolver;
  readonly #orderWatchers = new Map<string, IbkrFillWatcher>();
  readonly #candleListenerByTopic = new Map<string, (candle: unknown) => void>();
  /** What the caller asked for, if anything; the settled id lives in `#accountIdPromise`. */
  readonly #requestedAccountId?: string | undefined;

  /** Shared so a concurrent burst of calls selects the account once rather than racing. */
  #accountIdPromise?: Promise<string> | undefined;

  constructor(options?: IbkrBrokerOptions) {
    super(IbkrBroker.NAME);
    /*
     * Credentials mean "run the gateway for me". The launcher is imported dynamically and only on
     * first use: it reaches `node:child_process` and Playwright, which a bundler following this
     * package's static graph for the browser cannot resolve. Starting it is lazy for a second
     * reason too — a fresh login waits on the IB Key push, which must not block construction.
     */
    const credentials = options?.account && options.password ? {...options} : undefined;
    this.#credentials = credentials;
    this.#gatewayState = credentials ? {stage: IbkrGatewayStage.IDLE} : undefined;

    this.#api = new IbkrAPI({
      gatewayUrl: options?.gatewayUrl,
      ...(credentials ? {waitForSession: () => this.#launchGateway(credentials)} : {}),
    });
    this.#conids = new IbkrConidResolver(this.#api);
    this.#currencies = new IbkrCurrencyResolver({api: this.#api, getAccountId: () => this.getAccountId()});
    this.#marketData = options?.marketData ?? new IbkrMarketData({api: this.#api, conids: this.#conids});
    this.#overnight = options?.overnight ?? false;
    this.#timeInForce = options?.timeInForce ?? IbkrTimeInForce.GTC;
    this.#requestedAccountId = options?.accountId;
  }

  get api(): IbkrAPI {
    return this.#api;
  }

  /** Resolves when the gateway has a session; at once when it is not ours. @see {@link IbkrGatewayLauncher} */
  get ready(): Promise<void> {
    return this.#gatewayState ? this.#launchGateway(this.#credentials) : Promise.resolve();
  }

  /**
   * Gateway progress, for telling a caller what is being waited on; `undefined` when not ours.
   *
   * Kept as a local snapshot updated by the launcher's callback rather than read off the launcher,
   * which only exists once the dynamic import has resolved. That keeps this a plain getter.
   */
  get gatewayState(): IbkrGatewayState | undefined {
    return this.#gatewayState;
  }

  async #launchGateway(credentials: IbkrBrokerOptions | undefined): Promise<void> {
    if (!credentials?.account || !credentials.password) {
      return;
    }

    this.#gatewayPromise ??= import('./gateway/IbkrGatewayLauncher.js').then(({IbkrGatewayLauncher}) =>
      IbkrGatewayLauncher.for({
        account: credentials.account ?? '',
        gatewayUrl: credentials.gatewayUrl,
        onStateChange: state => {
          this.#gatewayState = state;
          credentials.onGatewayStateChange?.(state);
        },
        password: credentials.password ?? '',
        twoFactorMethod: credentials.twoFactorMethod,
      })
    );

    await (
      await this.#gatewayPromise
    ).ready;
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
    this.#accountIdPromise ??= resolveIbkrAccountId({api: this.#api, requested: this.#requestedAccountId});
    return this.#accountIdPromise;
  }

  /** Resolves a ticker to IBKR's numeric contract id, which every other endpoint is keyed by. */
  async getConid(pair: TradingPair): Promise<number> {
    return this.#conids.getConid(pair);
  }

  /**
   * Ledger cash and open positions, every page of them.
   *
   * Cash is reported per currency, exactly as IBKR holds it. What can actually be spent on one
   * pair is a different question, because IBKR converts as it fills — see
   * {@link getAvailableBalances}.
   */
  async listBalances(): Promise<Balance[]> {
    const {ledger, positions} = await this.#loadPortfolio();
    return IbkrBrokerMapper.toBalances(ledger, positions);
  }

  /** The raw ledger and every page of positions, fetched together. */
  async #loadPortfolio() {
    const accountId = await this.getAccountId();
    const [ledger, positions] = await Promise.all([
      this.#api.getLedger(accountId),
      getAllIbkrPositions({accountId, api: this.#api}),
    ]);
    return {ledger, positions};
  }

  /**
   * Overridden because a per-currency cash balance is not what IBKR lets an order spend.
   *
   * IBKR funds a USD trade out of a EUR balance by converting on the fly, so a EUR-funded
   * account can buy a US stock while its ledger shows no USD whatsoever. The inherited version
   * looks for a row in the counter currency, finds none, and reports zero — which an order-sizing
   * caller reads as "no buying power", so the strategy never buys.
   *
   * The counter side is therefore the account's whole settled cash expressed in that currency.
   * The base side keeps the inherited answer, since that one is a position in the instrument
   * rather than cash and no conversion applies.
   *
   * {@link toAvailableCash} declines to convert when the ledger cannot support it, and the
   * per-currency figure stands in that case — understating funds rather than overstating them.
   */
  override async getAvailableBalances(pair: TradingPair): Promise<ExchangeAvailableBalance> {
    const {ledger, positions} = await this.#loadPortfolio();
    const balances = IbkrBrokerMapper.toBalances(ledger, positions);
    const availableOf = (currency: string) =>
      new Big(balances.find(balance => balance.currency === currency)?.available ?? 0);

    return {
      base: availableOf(pair.base),
      counter: toAvailableCash(ledger, pair.counter) ?? availableOf(pair.counter),
    };
  }

  async getOpenOrders(pair: TradingPair): Promise<PendingOrder[]> {
    const conid = await this.getConid(pair);
    const orders = await getCompleteIbkrLiveOrders(this.#api);

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
   *
   * Nothing is returned while the order is still working. A partially filled order already has
   * executions in `getTrades()`, and reporting those as the fill would break the
   * {@link Broker.getFillByOrderId} contract of `undefined` until an order is done — a caller
   * would read a four-share order as filled on its first share.
   */
  async getFillByOrderId(pair: TradingPair, orderId: string): Promise<Fill | undefined> {
    if (await isIbkrOrderWorking(this.#api, orderId)) {
      return undefined;
    }

    return mergeFills((await this.getFills(pair)).filter(fill => fill.order_id === orderId));
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
   * Asks IBKR what the order would cost, falling back to the schedule applied locally when there
   * is no session to ask.
   *
   * @see {@link estimateIbkrFee}
   */
  override async estimateFee(
    pair: TradingPair,
    /** Unused: IBKR bills the same commission whether the order is a limit or a market order. */
    _orderType: OrderType,
    notional: Big,
    ticket?: {price?: Big; size?: Big}
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
      ticket,
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
   *
   * One event per completed order, with its executions merged, rather than one per execution:
   * see {@link startIbkrFillWatcher}.
   */
  async watchOrders(): Promise<string> {
    const topicId = createFillTopicId();

    const watcher = await startIbkrFillWatcher({
      api: this.#api,
      emit: fill => this.emit(topicId, fill),
      getFeeAsset: pair => this.getFeeAsset(pair),
      getQuoteCurrency: conid => this.#currencies.getQuoteCurrency(conid),
      isStillWorking: orderId => isIbkrOrderWorking(this.#api, orderId),
      pollIntervalMs: IbkrBroker.ORDER_POLL_INTERVAL_MS,
    });

    this.#orderWatchers.set(topicId, watcher);

    return topicId;
  }

  unwatchOrders(topicId: string): void {
    const watcher = this.#orderWatchers.get(topicId);
    if (watcher) {
      watcher.stop();
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
    // Only a gateway this broker started is stopped; see `IbkrGatewayLauncher.stop`.
    void this.#gatewayPromise?.then(launcher => launcher.stop());
  }
}
