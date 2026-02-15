import Big from 'big.js';
import axios from 'axios';
import {ms} from 'ms';
import {AlpacaExchangeMapper} from './AlpacaExchangeMapper.js';
import {
  Exchange,
  type ExchangeBalance,
  type ExchangeCandle,
  type ExchangeCandleImportRequest,
  type ExchangeFeeRate,
  type ExchangeFill,
  type ExchangeLimitOrderOptions,
  type ExchangeMarketOrderOptions,
  type ExchangeOrderOptions,
  ExchangeOrderPosition,
  ExchangeOrderSide,
  ExchangeOrderType,
  type ExchangePendingLimitOrder,
  type ExchangePendingMarketOrder,
  type ExchangePendingOrder,
  type ExchangeTradingRules,
} from '../core/Exchange.js';
import {TradingPair} from '../core/TradingPair.js';
import {alpacaWebSocket, AlpacaConnection} from './AlpacaWebSocket.js';
import {CandleBatcher} from '../candle/CandleBatcher.js';
import type {MinuteBarMessage} from './api/schema/StreamSchema.js';
import {OrderStatus} from './api/schema/OrderSchema.js';
import {AlpacaAPI} from './api/AlpacaAPI.js';

export class AlpacaExchange extends Exchange {
  readonly #alpacaAPI: AlpacaAPI;
  readonly #SUBSCRIPTION_PLAN = 'iex' as const;
  static readonly STOCK_STREAM_SOURCE = `v2/iex`;
  static readonly CRYPTO_STREAM_SOURCE = `v1beta3/crypto/us`;

  #candleTopics: Map<string, {symbol: string; connectionId: string}> = new Map();
  readonly #connectStream: (source: string) => Promise<AlpacaConnection>;

  constructor(options: {apiKey: string; apiSecret: string; usePaperTrading: boolean}) {
    super(AlpacaExchange.NAME);

    this.#alpacaAPI = new AlpacaAPI({
      apiKey: options.apiKey,
      apiSecret: options.apiSecret,
      usePaperTrading: options.usePaperTrading,
    });

    // Wrap Stream connection, so that nothing async happens when the "constructor" of this class is being called
    this.#connectStream = async (source: string): Promise<AlpacaConnection> => {
      return alpacaWebSocket.connect(options, source);
    };
  }

  static NAME = 'Alpaca';

  #createSymbol(pair: TradingPair, isCrypto: boolean): string {
    if (isCrypto) {
      return `${pair.base}/${pair.counter}`;
    }
    return pair.base;
  }

  async getLatestCandle(pair: TradingPair, intervalInMillis: number): Promise<ExchangeCandle> {
    const isCrypto = await this.#isCryptoSymbol(pair);
    const symbol = this.#createSymbol(pair, isCrypto);
    const fetchMethod = isCrypto ? this.#fetchLatestCryptoBars.bind(this) : this.#fetchLatestStockBars.bind(this);
    const {bars} = await fetchMethod(pair);
    // Alpaca only provides minute-bars data, which means we need to determine the time frame and retrieve all candles
    // within that range to construct a complete candle with the specified interval.
    const startTimeLastCandle = new Date(bars[symbol].t).getTime();
    const startTimeFirstCandle = startTimeLastCandle - intervalInMillis + ms('1m');
    const candles = await this.getCandles(pair, {
      intervalInMillis,
      startTimeFirstCandle: new Date(startTimeFirstCandle).toISOString(),
      startTimeLastCandle: new Date(startTimeLastCandle).toISOString(),
    });
    return candles[0]!;
  }

  async #fetchLatestStockBars(pair: TradingPair) {
    return this.#alpacaAPI.getStockBarsLatest({
      feed: this.#SUBSCRIPTION_PLAN,
      symbols: this.#createSymbol(pair, false),
    });
  }

  async #fetchLatestCryptoBars(pair: TradingPair) {
    return this.#alpacaAPI.getCryptoBarsLatest({
      symbols: this.#createSymbol(pair, true),
    });
  }

  async #isCryptoSymbol(pair: TradingPair) {
    try {
      const response = await this.#fetchLatestCryptoBars(pair);
      return Object.keys(response.bars).length > 0;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status && status >= 400 && status < 500) {
        return false;
      }
      throw error;
    }
  }

  async #fetchCryptoBars(pair: TradingPair, request: ExchangeCandleImportRequest, pageToken: string | undefined) {
    return this.#alpacaAPI.getCryptoBars({
      end: request.startTimeLastCandle,
      limit: 10_000,
      page_token: pageToken,
      start: request.startTimeFirstCandle,
      symbols: this.#createSymbol(pair, true),
      timeframe: AlpacaExchangeMapper.mapInterval(request.intervalInMillis),
    });
  }

  #fetchStockBars(pair: TradingPair, request: ExchangeCandleImportRequest, pageToken: string | undefined) {
    if (pair.counter !== 'USD') {
      throw new Error(
        `Cannot use "${pair.counter}". Stock "${pair.base}" can only be traded in USD on ${AlpacaExchange.NAME}.`
      );
    }

    return this.#alpacaAPI.getStockBars({
      end: request.startTimeLastCandle,
      feed: this.#SUBSCRIPTION_PLAN,
      limit: 10_000,
      page_token: pageToken,
      start: request.startTimeFirstCandle,
      symbols: this.#createSymbol(pair, false),
      timeframe: AlpacaExchangeMapper.mapInterval(request.intervalInMillis),
    });
  }

  async getCandles(pair: TradingPair, request: ExchangeCandleImportRequest): Promise<ExchangeCandle[]> {
    const candles: ExchangeCandle[] = [];
    let pageToken: string | null | undefined = undefined;

    const isCrypto = await this.#isCryptoSymbol(pair);

    const fetchBars = isCrypto ? this.#fetchCryptoBars.bind(this) : this.#fetchStockBars.bind(this);

    do {
      // Make request
      const {bars, next_page_token} = await fetchBars(pair, request, pageToken);

      // Map bars
      const entries = Object.values(bars);
      for (const bars of entries) {
        bars.forEach(bar => {
          const candle = AlpacaExchangeMapper.toExchangeCandle(bar, pair, request.intervalInMillis);
          candles.push(candle);
        });
      }

      // Update next page
      pageToken = next_page_token;
    } while (pageToken);

    return candles;
  }

  getName(): string {
    return AlpacaExchange.NAME;
  }

  getSmallestInterval(): number {
    return ms('1m');
  }

  /**
   * Original time format from Alpaca is "RFC 3339" (i.e. "2023-08-08T18:58:27.26720022-04:00"),
   * we convert it to "ISO 8601 UTC" (i.e. "2023-08-08T22:58:27.267Z").
   */
  async getTime(): Promise<string> {
    const clock = await this.#alpacaAPI.getClock();
    return new Date(clock.timestamp).toISOString();
  }

  unwatchCandles(topicId: string): void {
    this.removeAllListeners(topicId);
    const topic = this.#candleTopics.get(topicId);
    if (topic) {
      alpacaWebSocket.unsubscribeFromBars(topic.connectionId, topic.symbol);
      this.#candleTopics.delete(topicId);
    }
  }

  /**
   * Alpaca emits candles during Stock Exchange opening times. Candles are always in minutes.
   * Crypto candles cannot be fetched with Alpaca's SDK:
   * https://github.com/alpacahq/alpaca-ts/issues/93#issuecomment-1692414770
   *
   * @note: You will only receive candles when the exchange is actually open (working hours)!
   *
   * @see https://docs.alpaca.markets/docs/real-time-stock-pricing-data#daily-bars-dailybars
   * @see https://docs.alpaca.markets/docs/real-time-crypto-pricing-data
   */
  async watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string> {
    const topicId = crypto.randomUUID();
    const isCrypto = await this.#isCryptoSymbol(pair);
    const symbol = this.#createSymbol(pair, isCrypto);
    const source = isCrypto ? AlpacaExchange.CRYPTO_STREAM_SOURCE : AlpacaExchange.STOCK_STREAM_SOURCE;
    const cb = new CandleBatcher(intervalInMillis);
    const connection = await this.#connectStream(source);
    const smallestInterval = this.getSmallestInterval();
    alpacaWebSocket.subscribeToBars(connection.connectionId, symbol, (message: MinuteBarMessage) => {
      const isNewer = new Date(message.t).getTime() > new Date(openTimeInISO).getTime();
      if (isNewer) {
        // Bars from Alpaca always come in minutes:
        // https://docs.alpaca.markets/docs/real-time-stock-pricing-data#minute-bars-bars
        const candle = AlpacaExchangeMapper.toExchangeCandle(message, pair, smallestInterval);

        if (intervalInMillis === smallestInterval) {
          // No batching needed — each minute bar is already the desired interval
          this.emit(topicId, candle);
        } else {
          // Emit batched candle (which will match the desired interval)
          const batchedCandle = cb.addToBatch(candle);
          if (batchedCandle) {
            this.emit(topicId, batchedCandle);
          }
        }
      }
    });

    this.#candleTopics.set(topicId, {symbol, connectionId: connection.connectionId});
    return topicId;
  }

  disconnect(): void {
    for (const topic of this.#candleTopics.values()) {
      alpacaWebSocket.unsubscribeFromBars(topic.connectionId, topic.symbol);
    }
    this.#candleTopics.clear();
  }

  async #createReliableSymbol(pair: TradingPair): Promise<string> {
    const isCrypto = await this.#isCryptoSymbol(pair);
    return this.#createSymbol(pair, isCrypto);
  }

  /**
   * Note: The quantity of a position is negative (i.e. -100) if it is a SHORT position.
   *
   * @see https://docs.alpaca.markets/reference/getallopenpositions
   */
  async listBalances(): Promise<ExchangeBalance[]> {
    const balances: ExchangeBalance[] = [];

    const positions = await this.#alpacaAPI.getPositions();

    for (const position of positions) {
      const cashSymbol = 'USD';
      // A USDT/USD symbol is returned as "USDTUSD" on Alpaca, so we have to adjust this
      const needsTrimming = position.asset_class === 'crypto' && position.symbol.endsWith(cashSymbol);
      const currency = needsTrimming ? position.symbol.replace(/USD$/, '') : position.symbol;
      const side = position.side === 'long' ? ExchangeOrderPosition.LONG : ExchangeOrderPosition.SHORT;

      balances.push({
        // We are using absolute values here to have positive quantity for SHORT positions
        available: new Big(position.qty).abs().toFixed(),
        currency,
        hold: '0',
        position: side,
      });
    }

    // The Alpaca exchange handles available portfolio cash within the "Account API"
    // @see https://alpaca.markets/docs/api-references/trading-api/account/
    const account = await this.#alpacaAPI.getAccount();

    // @see https://docs.alpaca.markets/docs/user-protection#pattern-day-trader-pdt-protection-at-alpaca
    if (parseFloat(account.last_equity || '0') < 25_000) {
      console.warn(
        `Your account isn't entitled for Pattern Day Trader (PDT). Your equity ("${account.last_equity} USD") as of previous trading day at 16:00:00 ET is too low. Read more: https://docs.alpaca.markets/docs/user-protection#pattern-day-trader-pdt-protection-at-alpaca`
      );
    }

    balances.push({
      available: new Big(account.cash).toFixed(),
      currency: account.currency,
      hold: '0',
      position: ExchangeOrderPosition.LONG,
    });

    return balances;
  }

  async cancelOpenOrders(pair: TradingPair): Promise<string[]> {
    const canceledOrders: string[] = [];
    const symbol = await this.#createReliableSymbol(pair);
    const openOrders = await this.#alpacaAPI.getOrders({status: 'open', symbols: symbol});
    const deleteOrders = openOrders.map(openOrder => {
      canceledOrders.push(openOrder.id);
      return this.cancelOrderById(pair, openOrder.id);
    });
    await Promise.all(deleteOrders);
    return canceledOrders;
  }

  async cancelOrderById(_pair: TradingPair, orderId: string): Promise<void> {
    await this.#alpacaAPI.deleteOrder(orderId);
  }

  /**
   * @see https://docs.alpaca.markets/reference/getallorders
   */
  async getFills(pair: TradingPair): Promise<ExchangeFill[]> {
    const symbol = await this.#createReliableSymbol(pair);
    const orders = await this.#alpacaAPI.getOrders({status: 'closed', symbols: symbol});
    const filledOrders = orders.filter(order => order.status === OrderStatus.FILLED);
    return filledOrders.map(order => AlpacaExchangeMapper.toFilledOrder(order, pair));
  }

  async getFillByOrderId(pair: TradingPair, orderId: string): Promise<ExchangeFill | undefined> {
    const fills = await this.getFills(pair);
    return fills.find(fill => fill.order_id === orderId);
  }

  /**
   * Notes:
   * - For "USD" pairs, the minimum order size calculation is: 1/USD asset price.
   * - You can now buy as little as $1 worth of shares for over 2,000 US equities.
   *
   * @see https://docs.alpaca.markets/docs/fractional-trading
   * @see https://docs.alpaca.markets/docs/crypto-trading-1#minimum-order-size
   */
  async getTradingRules(pair: TradingPair): Promise<ExchangeTradingRules> {
    const isCrypto = await this.#isCryptoSymbol(pair);
    const symbol = this.#createSymbol(pair, isCrypto);
    const assetClass = isCrypto ? 'crypto' : 'us_equity';
    const assets = await this.#alpacaAPI.getAssets({asset_class: assetClass});
    const asset = assets.find(a => a.symbol === symbol);

    if (asset) {
      if (asset.class === 'crypto' && asset.min_order_size && asset.min_trade_increment && asset.price_increment) {
        return {
          base_increment: asset.min_trade_increment,
          base_max_size: Number.MAX_SAFE_INTEGER.toString(),
          base_min_size: asset.min_order_size,
          counter_increment: asset.price_increment,
          counter_min_size: pair.counter === 'USD' ? '1' : '0',
          pair,
        };
      }
      return {
        base_increment: '0.00000001',
        base_max_size: Number.MAX_SAFE_INTEGER.toString(),
        base_min_size: '0',
        counter_increment: '0.01',
        counter_min_size: '1',
        pair,
      };
    }

    throw new Error(`Could not find trading rules for symbol "${symbol}" of asset class "${assetClass}".`);
  }

  /**
   * The crypto fee will be charged on the credited crypto asset/fiat (what you receive) per trade.
   *
   * @see https://docs.alpaca.markets/docs/crypto-fees
   * @see https://files.alpaca.markets/disclosures/library/BrokFeeSched.pdf
   */
  async getFeeRates(_pair: TradingPair): Promise<ExchangeFeeRate> {
    // TODO: Refine according to "30-Day Crypto Volume (USD)" and make fee rate dependant on crypto or stocks
    return {
      [ExchangeOrderType.MARKET]: new Big(0.0025),
      [ExchangeOrderType.LIMIT]: new Big(0.0015),
    };
  }

  /**
   * Note: Alpaca supports SHORT orders but does not support holding a LONG & SHORT order simultaneously.
   *
   * @see https://docs.alpaca.markets/docs/working-with-orders#place-new-orders
   */
  protected override async placeOrder(pair: TradingPair, options: ExchangeLimitOrderOptions): Promise<ExchangePendingLimitOrder>;
  protected override async placeOrder(pair: TradingPair, options: ExchangeMarketOrderOptions): Promise<ExchangePendingMarketOrder>;
  protected override async placeOrder(pair: TradingPair, options: ExchangeOrderOptions): Promise<ExchangePendingOrder> {
    const isCrypto = await this.#isCryptoSymbol(pair);
    const symbol = this.#createSymbol(pair, isCrypto);
    // Cannot use 'gtc' for stocks because fractional orders must be 'day' orders (error code: 42210000)
    // On the other hand, crypto orders cannot use 'day' and must be placed with 'gtc' (error code: 42210000)
    const time_in_force = isCrypto ? 'gtc' : 'day';
    const side = options.side === ExchangeOrderSide.BUY ? 'buy' : 'sell';
    const type = options.type === ExchangeOrderType.MARKET ? 'market' : 'limit';

    const config: {
      extended_hours?: boolean;
      limit_price?: string;
      notional?: string;
      qty?: string;
      side: string;
      symbol: string;
      time_in_force: string;
      type: string;
    } = {
      side,
      symbol,
      time_in_force,
      type,
    };

    if (options.sizeInCounter) {
      config.notional = options.size;
    } else {
      config.qty = options.size;
    }

    if (options.type === ExchangeOrderType.LIMIT) {
      config.limit_price = options.price;
    }

    // @see https://docs.alpaca.markets/docs/orders-at-alpaca#submitting-an-extended-hours-eligible-order
    const isEligibleForExtendedHours = type === 'limit' && time_in_force === 'day';
    if (isEligibleForExtendedHours) {
      config.extended_hours = true;
    }

    const order = await this.#alpacaAPI.postOrder(config);
    return AlpacaExchangeMapper.toExchangePendingOrder(order, pair, options);
  }

  getMarkdownLink(): string {
    return '[Alpaca](https://alpaca.markets/)';
  }

  getTradingLink(pair: TradingPair): string {
    return `https://app.alpaca.markets/trade/${pair.base}`;
  }
}
