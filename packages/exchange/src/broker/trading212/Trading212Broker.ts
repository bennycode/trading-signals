import {randomUUID} from 'node:crypto';
import Big from 'big.js';
import {ms} from 'ms';
import {
  Broker,
  OrderPosition,
  OrderSide,
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
import {TradingPair} from '../TradingPair.js';
import {MarketDataSource} from '../MarketDataSource.js';
import {Trading212API} from './api/Trading212API.js';
import {Trading212OrderStatus, Trading212TimeValidity} from './api/schema/OrderSchema.js';
import {Trading212BrokerMapper} from './Trading212BrokerMapper.js';

export class Trading212Broker extends Broker implements MarketDataSource {
  static readonly NAME = 'Trading212';

  /**
   * Trading212 charges 0% commission on equity trades. Currency-conversion fees apply on
   * trades whose instrument currency differs from the account currency — `getFeeRates`
   * surfaces those as `CURRENCY_CONVERSION_FEE` so strategies can subtract them up front.
   *
   * @see https://helpcentre.trading212.com/hc/en-us/articles/360008842317
   */
  static readonly DEFAULT_FEE_RATES: FeeRate = {
    [OrderType.MARKET]: new Big(0),
    [OrderType.LIMIT]: new Big(0),
  };

  /**
   * Trading212's documented rate for currency-conversion fees on cross-currency trades
   * (~0.15% per leg). The actual amount on each fill comes back via
   * `fill.walletImpact.taxes[].quantity` and may vary slightly with the FX rate of the day.
   *
   * @see https://helpcentre.trading212.com/hc/en-us/articles/360008842317
   */
  static readonly CURRENCY_CONVERSION_FEE_RATE = new Big(0.0015);

  /**
   * Default poll interval for `watchOrders()`. Trading212 documents `/equity/history/orders`
   * as 1 req / 60s, so going faster just burns into the retry-delay window.
   */
  static readonly ORDER_POLL_INTERVAL_MS = 60_000;

  readonly #api: Trading212API;
  readonly #orderWatchers = new Map<string, NodeJS.Timeout>();
  readonly #orderStoppers = new Map<string, () => void>();
  readonly #marketData: MarketDataSource;
  readonly #candleListenerByTopic = new Map<string, (candle: unknown) => void>();

  constructor(options: {
    apiKey: string;
    apiSecret: string;
    usePaperTrading: boolean;
    /**
     * Market-data source. Required: candle methods delegate here. Trading212's public API
     * exposes no historical bars and no public WebSocket, so the data source has to come
     * from outside (e.g. `AlpacaMarketData`). Lifecycle is owned by the caller —
     * `disconnect()` on this class does not close it.
     */
    marketData: MarketDataSource;
  }) {
    super(Trading212Broker.NAME);
    this.#api = new Trading212API(options);
    this.#marketData = options.marketData;
  }

  /**
   * Trading212 vendor tickers carry a `_<COUNTRY>_<TYPE>` suffix (e.g. `AAPL_US_EQ`) that
   * external data sources don't recognise. Strip the last two underscore-separated segments
   * (country + asset type) and join any remaining intra-symbol underscores with dots —
   * e.g. `BRK_B_US_EQ` → `BRK.B`, the convention most US data providers use for class shares.
   */
  static toMarketDataPair(pair: TradingPair) {
    const segments = pair.base.split('_');
    const ticker = segments.length > 2 ? segments.slice(0, -2).join('.') : pair.base;
    return new TradingPair(ticker, pair.counter);
  }

  getName(): string {
    return Trading212Broker.NAME;
  }

  /**
   * Trading212 has no historical-bar endpoint, but the `Broker` contract requires a value.
   * Returning 1m matches the granularity strategies typically expect.
   */
  getSmallestInterval(): number {
    return ms('1m');
  }

  /**
   * Trading212 does not expose a server-time endpoint. The local clock is returned in ISO 8601
   * UTC; callers that need exchange-side time should consult instrument working schedules.
   */
  async getTime(): Promise<string> {
    return new Date().toISOString();
  }

  async getCandles(pair: TradingPair, request: CandleImportRequest): Promise<Candle[]> {
    return this.#marketData.getCandles(Trading212Broker.toMarketDataPair(pair), request);
  }

  async getLatestCandle(pair: TradingPair, intervalInMillis: number): Promise<Candle> {
    return this.#marketData.getLatestCandle(Trading212Broker.toMarketDataPair(pair), intervalInMillis);
  }

  async watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string> {
    const topicId = await this.#marketData.watchCandles(
      Trading212Broker.toMarketDataPair(pair),
      intervalInMillis,
      openTimeInISO
    );
    const forwarder = (candle: unknown) => this.emit(topicId, candle);
    this.#marketData.on(topicId, forwarder);
    this.#candleListenerByTopic.set(topicId, forwarder);
    return topicId;
  }

  unwatchCandles(topicId: string): void {
    const forwarder = this.#candleListenerByTopic.get(topicId);
    if (forwarder) {
      this.#marketData.off(topicId, forwarder);
      this.#candleListenerByTopic.delete(topicId);
    }
    this.#marketData.unwatchCandles(topicId);
    this.removeAllListeners(topicId);
  }

  /**
   * Trading212 has no order-stream WebSocket, so this polls `/api/v0/equity/history/orders`
   * on a timer and emits any newly-`FILLED` entries since the last tick. Latency therefore
   * equals the poll interval (default 60s, matching Trading212's documented rate limit).
   *
   * The first tick takes a baseline snapshot so historical fills are not replayed.
   */
  async watchOrders(intervalInMillis: number = Trading212Broker.ORDER_POLL_INTERVAL_MS): Promise<string> {
    const topicId = randomUUID();

    const [accountInfo, instruments, baseline] = await Promise.all([
      this.#api.getAccountInfo(),
      this.#api.getInstruments(),
      this.#api.getHistoryOrdersPage(),
    ]);

    const tickerToCurrency = new Map(instruments.map(instrument => [instrument.ticker, instrument.currencyCode]));
    let lastSeenId = baseline.items
      .filter(item => item.order.id != null && item.order.status === Trading212OrderStatus.FILLED)
      .reduce((max, item) => Math.max(max, item.order.id ?? 0), 0);
    let stopped = false;

    const tick = async () => {
      try {
        // Page through history (newest first) until we reach an id we've already seen.
        // Without this loop, more than 50 fills between polls would silently drop the older
        // ones off the first page.
        const newFills: typeof baseline.items = [];
        let nextPath: string | null = null;
        do {
          const page = await this.#api.getHistoryOrdersPage(nextPath ? {nextPath} : undefined);
          let reachedSeen = false;
          for (const item of page.items) {
            const orderId = item.order.id;
            if (orderId != null && orderId <= lastSeenId) {
              reachedSeen = true;
              break;
            }
            if (item.order.status === Trading212OrderStatus.FILLED && orderId != null && item.fill) {
              newFills.push(item);
            }
          }
          nextPath = reachedSeen ? null : page.nextPagePath;
        } while (nextPath);

        newFills.sort((a, b) => (a.order.id ?? 0) - (b.order.id ?? 0));

        for (const item of newFills) {
          const ticker = item.order.ticker ?? '';
          const counter = tickerToCurrency.get(ticker) ?? accountInfo.currencyCode;
          const pair = new TradingPair(ticker, counter);
          this.emit(topicId, Trading212BrokerMapper.toFilledOrder(item, pair, accountInfo.currencyCode));
          lastSeenId = Math.max(lastSeenId, item.order.id ?? 0);
        }
      } catch (error) {
        this.emit('error', error);
      } finally {
        if (!stopped) {
          this.#orderWatchers.set(topicId, setTimeout(tick, intervalInMillis));
        }
      }
    };

    this.#orderWatchers.set(topicId, setTimeout(tick, intervalInMillis));
    this.#orderStoppers.set(topicId, () => {
      stopped = true;
    });
    return topicId;
  }

  unwatchOrders(topicId: string): void {
    this.#orderStoppers.get(topicId)?.();
    this.#orderStoppers.delete(topicId);
    const handle = this.#orderWatchers.get(topicId);
    if (handle) {
      clearTimeout(handle);
      this.#orderWatchers.delete(topicId);
    }
    this.removeAllListeners(topicId);
  }

  disconnect(): void {
    for (const stop of this.#orderStoppers.values()) {
      stop();
    }
    this.#orderStoppers.clear();
    for (const handle of this.#orderWatchers.values()) {
      clearTimeout(handle);
    }
    this.#orderWatchers.clear();
  }

  /**
   * Lists open positions plus account cash. Position currency is the Trading212 ticker
   * (e.g. "AAPL_US_EQ"); account cash uses the account's `currencyCode` (e.g. "EUR").
   */
  async listBalances(): Promise<Balance[]> {
    const [positions, cash, accountInfo] = await Promise.all([
      this.#api.getPositions(),
      this.#api.getAccountCash(),
      this.#api.getAccountInfo(),
    ]);

    const balances: Balance[] = positions.map(position => ({
      available: new Big(position.quantity).abs().toFixed(),
      currency: position.ticker,
      hold: '0',
      position: position.quantity < 0 ? OrderPosition.SHORT : OrderPosition.LONG,
    }));

    balances.push({
      available: new Big(cash.free).toFixed(),
      currency: accountInfo.currencyCode,
      hold: new Big(cash.blocked ?? 0).toFixed(),
      position: OrderPosition.LONG,
    });

    return balances;
  }

  async getOpenOrders(pair: TradingPair): Promise<PendingOrder[]> {
    const orders = await this.#api.getOrders();
    // Drop STOP / STOP_LIMIT orders (e.g. placed manually in the Trading212 app): the
    // neutral `OrderType` only models MARKET and LIMIT, so mapping these would
    // silently lose `stopPrice` and mis-classify them as MARKET.
    return orders
      .filter(order => order.ticker === pair.base && (order.type === 'MARKET' || order.type === 'LIMIT'))
      .map(order => Trading212BrokerMapper.toOpenOrder(order, pair));
  }

  async cancelOrderById(_pair: TradingPair, orderId: string): Promise<void> {
    await this.#api.cancelOrder(Number(orderId));
  }

  async cancelOpenOrders(pair: TradingPair): Promise<string[]> {
    const orders = await this.#api.getOrders();
    const matching = orders.filter(order => order.ticker === pair.base);
    await Promise.all(matching.map(order => this.#api.cancelOrder(order.id)));
    return matching.map(order => `${order.id}`);
  }

  async getFills(pair: TradingPair): Promise<Fill[]> {
    const [history, accountInfo] = await Promise.all([
      this.#api.getHistoryOrders(pair.base),
      this.#api.getAccountInfo(),
    ]);
    return history
      .filter(item => item.order.id != null && item.order.status === Trading212OrderStatus.FILLED && item.fill)
      .map(item => Trading212BrokerMapper.toFilledOrder(item, pair, accountInfo.currencyCode));
  }

  async getFillByOrderId(pair: TradingPair, orderId: string): Promise<Fill | undefined> {
    const fills = await this.getFills(pair);
    return fills.find(fill => fill.order_id === orderId);
  }

  async getTradingRules(pair: TradingPair): Promise<TradingRules> {
    const instruments = await this.#api.getInstruments();
    const instrument = instruments.find(item => item.ticker === pair.base);

    if (!instrument) {
      throw new Error(`Could not find Trading212 instrument with ticker "${pair.base}".`);
    }

    if (instrument.currencyCode !== pair.counter) {
      throw new Error(
        `Instrument "${pair.base}" is quoted in "${instrument.currencyCode}", not "${pair.counter}".`
      );
    }

    // Trading212's `minTradeQuantity` is the floor *and* the increment for fractional shares.
    // Use the same non-zero fallback for both — falling back to '0' on `base_min_size` would
    // let computed sizes of zero pass `TradingSession`'s min-size guard.
    const minQuantity = `${instrument.minTradeQuantity ?? '0.000000001'}`;
    return {
      base_increment: minQuantity,
      base_max_size: `${instrument.maxOpenQuantity ?? Number.MAX_SAFE_INTEGER}`,
      base_min_size: minQuantity,
      counter_increment: '0.01',
      counter_min_size: '1',
      pair,
    };
  }

  async getFeeRates(pair: TradingPair): Promise<FeeRate> {
    const accountInfo = await this.#api.getAccountInfo();
    const isCrossCurrency = accountInfo.currencyCode !== pair.counter;
    return {
      ...Trading212Broker.DEFAULT_FEE_RATES,
      ...(isCrossCurrency && {CURRENCY_CONVERSION_FEE: Trading212Broker.CURRENCY_CONVERSION_FEE_RATE}),
    };
  }

  /**
   * Trading212 debits all fees in the account currency, not the instrument currency.
   * Strategies on a EUR account trading USD stocks see fees in EUR.
   */
  protected override async getFeeAsset(_pair: TradingPair): Promise<string> {
    const accountInfo = await this.#api.getAccountInfo();
    return accountInfo.currencyCode;
  }

  protected override async placeOrder(
    pair: TradingPair,
    options: LimitOrderOptions
  ): Promise<PendingLimitOrder>;
  protected override async placeOrder(
    pair: TradingPair,
    options: MarketOrderOptions
  ): Promise<PendingMarketOrder>;
  protected override async placeOrder(pair: TradingPair, options: OrderOptions): Promise<PendingOrder> {
    if (options.sizeInCounter) {
      throw new Error('Notional (sizeInCounter) orders are not supported by the Trading212 public API.');
    }

    // Trading212 encodes side in the sign of `quantity`: positive = BUY, negative = SELL.
    const signedQuantity = options.side === OrderSide.SELL ? -Number(options.size) : Number(options.size);

    if (options.type === OrderType.LIMIT) {
      // Trading212 rejects GTC for stock limit orders ("Invalid payload"). DAY is the only
      // time-in-force that works across paper and live for equity limit orders.
      const order = await this.#api.placeLimitOrder({
        limitPrice: Number(options.price),
        quantity: signedQuantity,
        ticker: pair.base,
        timeValidity: Trading212TimeValidity.DAY,
      });
      return Trading212BrokerMapper.toPendingOrder(order, pair, options);
    }

    const order = await this.#api.placeMarketOrder({
      quantity: signedQuantity,
      ticker: pair.base,
    });
    return Trading212BrokerMapper.toPendingOrder(order, pair, options);
  }
}
