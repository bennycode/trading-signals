import {randomUUID} from 'node:crypto';
import Big from 'big.js';
import {ms} from 'ms';
import {
  Broker,
  OrderType,
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
  type TradingRules,
} from '../Broker.js';
import type {MarketDataSource} from '../MarketDataSource.js';
import {TradingPair} from '../TradingPair.js';
import {IbkrAPI} from './api/IbkrAPI.js';
import {
  IbkrOrderSide,
  IbkrOrderType,
  IbkrTimeInForce,
  isIbkrOrderReplyMessage,
  isIbkrOrderSubmitError,
  isIbkrOrderSubmitSuccess,
  type IbkrOrderRequest,
} from './api/schema/OrderSchema.js';
import {IbkrBrokerMapper} from './IbkrBrokerMapper.js';
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

  /**
   * IBKR's Fixed US-equity commission: USD 0.005 per share, at least USD 1.00 per order, never
   * more than 1% of trade value. Read off this account's own `whatif` previews for Ford at USD
   * 11.50 — 1 share costs 0.12, 2 cost 0.23, 5 cost 0.58, and 10 through 100 all cost 1.00, which
   * is `min(max(0.005 × shares, 1.00), 1% × notional)` at every point.
   *
   * The Tiered schedule (0.0035 per share, 0.35 minimum) does not apply here, and the 1% cap is
   * what makes a small order cheap: a single share is billed 1% of 11.50 rather than the 1.00
   * minimum. Only {@link estimateFee}'s offline fallback uses these; a live estimate asks IBKR
   * and a realised fee arrives on the fill.
   *
   * @see https://www.interactivebrokers.com/en/pricing/commissions-stocks.php
   */
  static readonly COMMISSION_PER_SHARE = new Big('0.005');
  static readonly COMMISSION_MINIMUM = new Big('1');
  static readonly COMMISSION_MAX_RATE = new Big('0.01');

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

  constructor(options?: {
    accountId?: string;
    gatewayUrl?: string;
    /**
     * Routes limit orders to IBKR Overnight, the 20:00–03:50 ET session, which together with the
     * regular and extended sessions gives near-continuous weekday coverage.
     *
     * Off by default, because it is not a widening of a day order: the overnight venue is separate,
     * carries its own liquidity and spreads, and only limit orders reach it — a market order is
     * refused rather than quietly held until the opening bell.
     *
     * No extra permission is needed: Client Portal lists permissions per product and has no
     * overnight tile, and IBKR states that an existing US stock permission covers the session.
     *
     * Failure here is silent, so recognise it rather than debug it. An order IBKR will not honour
     * is still accepted, reports `tif: OND` and `Submitted`, and is then cancelled unfilled once
     * the session opens, with no reason on the order and `warning_message: null`. A `whatif`
     * preview does not catch it either, since it prices a ticket it will never route.
     */
    overnight?: boolean;
    /**
     * How long an unfilled order rests. `GTC` by default, so an order survives the close rather
     * than being silently discarded — IBKR accepts it for every order type and alongside
     * `outsideRTH`, so nothing here forces `DAY`. Alpaca makes the same choice wherever its API
     * allows it.
     *
     * Pass `DAY` for a strategy that re-places its orders each candle, so yesterday's unfilled
     * order cannot fire on a thesis that has since expired.
     *
     * Ignored when `overnight` is set, which needs its own time-in-force to reach that venue.
     */
    timeInForce?: typeof IbkrTimeInForce.DAY | typeof IbkrTimeInForce.GTC;
    /**
     * Another provider's feed, for instruments IBKR serves no bars for. Defaults to
     * {@link IbkrMarketData}, so IBKR's own history endpoint supplies candles and no second
     * provider is needed. An injected source's lifecycle belongs to whoever constructed it —
     * `disconnect()` does not close it.
     */
    marketData?: MarketDataSource;
  }) {
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
   * Proves there is a usable session. A gateway that is running but not logged in answers 401 to
   * everything, so this reports that distinctly instead of letting it surface later as an
   * unexplained failure on the first real call.
   */
  override async verifyCredentials(): Promise<void> {
    const status = await this.#api.getAuthStatus().catch(() => undefined);

    if (!status?.authenticated) {
      // Opening a session is enough when the gateway is logged in but the session has lapsed.
      const initialized = await this.#api.initSession().catch(() => undefined);
      if (!initialized?.authenticated) {
        throw new Error(
          `The IBKR Client Portal Gateway at ${this.#api.defaults.baseURL} has no authenticated session. ` +
            `Log in at ${this.#api.defaults.baseURL} and approve the two-factor prompt.${
              status?.message ? ` Gateway reported: ${status.message}` : ''
            }`
        );
      }
    }

    await this.getAccountId();
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
   * The currency IBKR debits fees in. On a EUR account trading USD instruments this differs from
   * `pair.counter`, so fills and fee estimates would otherwise claim the wrong currency.
   */
  /**
   * The currency the account settles in, which is where a trade's funds come from but is *not*
   * what fees are denominated in — see {@link getFeeAsset}. Cached because it never changes.
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
    const rules = info.rules;

    /*
     * IBKR varies the price tick by price band and returns the bands in `incrementRules`. The
     * smallest one is used, so a limit price is never rejected for being finer than allowed at
     * the band it lands in.
     */
    const increments = (rules?.incrementRules ?? [])
      .map(rule => rule.increment)
      .filter((increment): increment is number => typeof increment === 'number' && increment > 0);
    const priceIncrement = increments.length > 0 ? Math.min(...increments) : (rules?.increment ?? 0.01);

    /*
     * Deliberately not `rules.sizeIncrement`: that is the step the order ticket's quantity
     * spinner moves by (IBKR reports 40 for AAPL, which trades one share at a time), so using it
     * would invent a 40-share minimum. The real floor is one share, or a fraction of one when
     * the contract and account allow fractional orders.
     */
    const fractionalDigits = rules?.fraqInt;
    const supportsFractional =
      (rules?.fraqTypes?.length ?? 0) > 0 && typeof fractionalDigits === 'number' && fractionalDigits > 0;
    /*
     * `toFixed()` rather than `toString()`: Big.js switches to exponential notation below 1e-7,
     * and a `base_increment` of "1e-8" is not a decimal any consumer can parse.
     */
    const sizeIncrement = supportsFractional ? new Big(1).div(new Big(10).pow(fractionalDigits)).toFixed() : '1';

    return {
      base_increment: sizeIncrement,
      /*
       * IBKR documents no per-instrument maximum; limits are margin- and risk-based and are
       * enforced at submission. Reporting a finite cap here would invent one.
       */
      base_max_size: String(Number.MAX_SAFE_INTEGER),
      base_min_size: sizeIncrement,
      counter_increment: String(priceIncrement),
      counter_min_size: '0',
      pair,
    };
  }

  /**
   * IBKR's commission as a rate, which it is not: the schedule has a per-order floor and a cap,
   * so the true rate depends on the order's size and no single number covers it. This reports the
   * rate a large order pays, `0.005 / price` under the 1% ceiling.
   *
   * Prefer {@link estimateFee}, which knows the notional and so can apply the floor and the cap —
   * for a small order those dominate, and this rate understates the fee several-fold.
   */
  async getFeeRates(pair: TradingPair): Promise<FeeRate> {
    const candle = await this.#marketData.getLatestCandle(pair, IbkrBroker.SMALLEST_INTERVAL_MS);
    const price = new Big(candle.close);

    const rate = price.gt(0) ? IbkrBroker.COMMISSION_PER_SHARE.div(price) : IbkrBroker.COMMISSION_MAX_RATE;
    const capped = rate.gt(IbkrBroker.COMMISSION_MAX_RATE) ? IbkrBroker.COMMISSION_MAX_RATE : rate;

    return {
      [OrderType.LIMIT]: capped,
      [OrderType.MARKET]: capped,
    };
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
   * Reads the figure out of a `whatif` commission, which is a display string rather than a number:
   * `"1.70 USD"`, a bare `"0.35"`, or a range like `"0.11 ... 0.12 USD"` when IBKR will not commit
   * to one value. The upper bound is taken, so an estimate is never optimistic.
   *
   * Stripping non-numeric characters instead would turn that range into `"0.11...0.12"`, which is
   * not a number — the throw was being swallowed and every ranged quote fell back to local
   * arithmetic.
   */
  static parseCommission(commission: string | null | undefined): Big | undefined {
    const figures = commission?.match(/\d+(?:\.\d+)?/g);
    const highest = figures?.at(-1);
    return highest === undefined ? undefined : new Big(highest);
  }

  static commissionFor(notional: Big, price: Big): Big {
    if (notional.lte(0) || price.lte(0)) {
      return new Big(0);
    }

    const shares = notional.div(price);
    const perShare = IbkrBroker.COMMISSION_PER_SHARE.mul(shares);
    const withFloor = perShare.lt(IbkrBroker.COMMISSION_MINIMUM) ? IbkrBroker.COMMISSION_MINIMUM : perShare;
    const cap = notional.mul(IbkrBroker.COMMISSION_MAX_RATE);
    const billed = withFloor.gt(cap) ? cap : withFloor;

    return new Big(billed.toFixed(2, Big.roundUp));
  }

  /**
   * Asks IBKR what the order would cost. `whatif` prices the exact ticket, which removes the need
   * to model the tiered schedule, the order minimum and the 1% cap locally. Falls back to the
   * arithmetic in {@link Broker.estimateFee} when the preview is unavailable — it needs a live
   * session and a resolvable contract, neither of which holds during a backtest.
   */
  override async estimateFee(
    pair: TradingPair,
    /** Unused: IBKR bills the same commission whether the order is a limit or a market order. */
    _orderType: OrderType,
    notional: Big
  ): Promise<{commission: Big; currencyConversion: Big; total: Big; feeAsset: string}> {
    const feeAsset = await this.getFeeAsset(pair);

    try {
      const [accountId, conid] = await Promise.all([this.getAccountId(), this.getConid(pair)]);
      const preview = await this.#api.previewOrder(accountId, {
        cashQty: Number(notional.toString()),
        conid,
        /*
         * Always previewed as a MARKET ticket, even when pricing a LIMIT order. `whatif` rejects a
         * LIMIT ticket that carries no `price` with "Invalid order price fields", and a fee
         * estimate has no limit price to offer. Asking as MARKET costs nothing in accuracy because
         * IBKR bills the same per-share commission either way, which is why `getFeeRates` reports
         * one rate for both.
         */
        orderType: IbkrOrderType.MARKET,
        side: IbkrOrderSide.BUY,
        tif: IbkrTimeInForce.DAY,
      });

      const value = IbkrBroker.parseCommission(preview.amount?.commission);
      if (value) {
        return {commission: value, currencyConversion: new Big(0), feeAsset, total: value};
      }
    } catch {
      // Fall through to the local estimate below.
    }

    /*
     * No session, so the schedule is applied locally. Deliberately not `super.estimateFee`, which
     * multiplies the notional by a flat rate: IBKR's floor and cap dominate a small order, and a
     * rate alone priced one Ford share at USD 0.005 against the 0.12 actually charged.
     */
    const candle = await this.#marketData.getLatestCandle(pair, IbkrBroker.SMALLEST_INTERVAL_MS);
    const commission = IbkrBroker.commissionFor(notional, new Big(candle.close));

    return {commission, currencyConversion: new Big(0), feeAsset, total: commission};
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

    const isLimit = options.type === OrderType.LIMIT;

    if (this.#overnight && !isLimit) {
      throw new Error(
        `IBKR Overnight accepts limit orders only, so a ${options.type} order for ${pair.asString('/')} cannot reach it. Place a limit order, or construct the broker without \`overnight\`.`
      );
    }

    const isNotional = options.type === OrderType.MARKET && options.sizeInCounter;
    const request: IbkrOrderRequest = {
      /*
       * A client-generated id makes a failed POST reconcilable: the order can be looked up by it
       * instead of guessing whether the request landed, and IBKR deduplicates a resubmission.
       */
      cOID: randomUUID().replaceAll('-', '').slice(0, 32),
      conid,
      orderType: isLimit ? IbkrOrderType.LIMIT : IbkrOrderType.MARKET,
      /*
       * Limit orders are marked for the extended sessions, matching what Alpaca's mapper does.
       * IBKR allows only limit-family types there (`orderTypesOutside`), and a market order sent
       * with this flag would be refused, so it is set for limit orders alone.
       *
       * Never alongside an overnight time-in-force: that picks IBKR Overnight, a venue of its own,
       * and the extended-hours flag describes the pre-market and after-hours books instead. IBKR
       * does not combine the two, and a `whatif` preview accepts the pair without complaint, so
       * sending both produced an order that reported `Submitted` and was then cancelled unfilled
       * when the session opened.
       */
      ...(isLimit && !this.#overnight ? {outsideRTH: true} : {}),
      side: options.side === 'BUY' ? IbkrOrderSide.BUY : IbkrOrderSide.SELL,
      /*
       * `OND` rather than `OVT`: an overnight-only order is cancelled at 03:50 ET if it has not
       * filled, which would silently drop a strategy's order before the regular session it was
       * probably meant to span. `OND` carries it through into that session instead.
       */
      tif: this.#overnight ? IbkrTimeInForce.OVERNIGHT_AND_DAY : this.#timeInForce,
      ...(isNotional ? {cashQty: Number(options.size)} : {quantity: Number(options.size)}),
      ...(isLimit ? {price: Number(options.price)} : {}),
    };

    let response = await this.#api.submitOrder(accountId, request);

    const MAX_CONFIRMATIONS = 5;
    for (let attempt = 0; attempt < MAX_CONFIRMATIONS; attempt++) {
      const entry = response[0];

      if (!entry) {
        throw new Error(`IBKR returned an empty response when placing an order for ${pair.asString('/')}.`);
      }

      if (isIbkrOrderSubmitSuccess(entry)) {
        const base: PendingOrder =
          options.type === OrderType.LIMIT
            ? {
                id: entry.order_id,
                pair,
                price: options.price,
                side: options.side,
                size: options.size,
                type: OrderType.LIMIT,
              }
            : {
                id: entry.order_id,
                pair,
                side: options.side,
                size: options.size,
                sizeInCounter: options.sizeInCounter,
                type: OrderType.MARKET,
              };
        return base;
      }

      if (isIbkrOrderReplyMessage(entry)) {
        response = await this.#api.replyToOrderMessage(entry.id, true);
        continue;
      }

      if (isIbkrOrderSubmitError(entry)) {
        throw new Error(`IBKR rejected the order for ${pair.asString('/')}: ${entry.error}`);
      }

      throw new Error(`IBKR returned an unrecognised order response for ${pair.asString('/')}.`);
    }

    throw new Error(
      `IBKR kept asking for confirmation after ${MAX_CONFIRMATIONS} replies when placing an order for ${pair.asString('/')}.`
    );
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
    const topicId = randomUUID();
    const seenExecutions = new Set<string>();
    let primed = false;

    const poll = async () => {
      try {
        const trades = await this.#api.getTrades();

        for (const trade of trades) {
          const executionId = trade.execution_id ?? `${trade.order_id}-${trade.trade_time_r}`;
          if (seenExecutions.has(executionId)) {
            continue;
          }
          seenExecutions.add(executionId);

          if (!primed) {
            continue;
          }

          // Currency conversions share this feed but are nobody's order — see `isInstrumentTrade`.
          if (!IbkrBrokerMapper.isInstrumentTrade(trade)) {
            continue;
          }

          const symbol = trade.symbol;
          if (!symbol) {
            continue;
          }

          const pair = new TradingPair(symbol, await this.#getQuoteCurrency(trade.conid));
          const fill = IbkrBrokerMapper.toFill(trade, pair, await this.getFeeAsset(pair));
          if (fill) {
            this.emit(topicId, fill);
          }
        }

        primed = true;
      } catch {
        // A failed poll is transient; the next tick tries again rather than killing the watcher.
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), IbkrBroker.ORDER_POLL_INTERVAL_MS);
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
