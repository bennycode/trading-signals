import {randomUUID} from 'node:crypto';
import Big from 'big.js';
import {ms} from 'ms';
import {SimplifiedHttpError} from '../../util/SimplifiedHttpError.js';
import {AlpacaBrokerMapper} from './AlpacaBrokerMapper.js';
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
  OrderPosition,
  OrderSide,
  OrderType,
  type PendingLimitOrder,
  type PendingMarketOrder,
  type PendingOrder,
  type TradingRules,
} from '../Broker.js';
import type {MarketDataSource} from '../MarketDataSource.js';
import type {TradingPair} from '../TradingPair.js';
import {createAlpacaSymbol, isAlpacaCryptoSymbol} from './alpacaSymbol.js';
import {AlpacaOrderStatus} from './api/schema/OrderSchema.js';
import {AlpacaAPI} from './api/AlpacaAPI.js';
import {PositionSide} from './api/schema/PositionSchema.js';
import {alpacaTradingWebSocket, type AlpacaTradingConnection} from './AlpacaTradingWebSocket.js';
import {TradeUpdateEvent, type TradeUpdateMessage} from './api/schema/TradingStreamSchema.js';

/**
 * Alpaca rejects to cancel already filled orders with:
 *
 * status: 422 Unprocessable Entity
 * body: {"code":42210000,"message":"order is already in \"filled\" state"}
 */
function isAlreadyFilledOrder(error: unknown): boolean {
  if (!(error instanceof SimplifiedHttpError) || error.status !== 422) {
    return false;
  }
  const data = error.data;
  return !!data && typeof data === 'object' && 'code' in data && data.code === 42210000;
}

export class AlpacaBroker extends Broker implements MarketDataSource {
  readonly #alpacaAPI: AlpacaAPI;
  readonly #marketData: MarketDataSource;
  readonly #candleListenerByTopic = new Map<string, (candle: unknown) => void>();

  readonly #orderTopics: Map<string, (message: TradeUpdateMessage) => void> = new Map();
  #tradingConnectionId: string | null = null;
  readonly #connectTradingStream: () => Promise<AlpacaTradingConnection>;

  constructor(options: {
    apiKey: string;
    apiSecret: string;
    usePaperTrading: boolean;
    /**
     * Market-data source for candle methods. Required: every broker delegates candle calls
     * to its `marketData`. The default Alpaca pairing comes from `getAlpacaClient`, which
     * wires an `AlpacaMarketData` from the same credentials.
     */
    marketData: MarketDataSource;
  }) {
    super(AlpacaBroker.NAME);

    this.#alpacaAPI = new AlpacaAPI({
      apiKey: options.apiKey,
      apiSecret: options.apiSecret,
      usePaperTrading: options.usePaperTrading,
    });

    this.#marketData = options.marketData;

    this.#connectTradingStream = async (): Promise<AlpacaTradingConnection> => {
      return alpacaTradingWebSocket.connect(options);
    };
  }

  static NAME = 'Alpaca';

  /**
   * Default Alpaca fee rates.
   *
   * @see https://docs.alpaca.markets/docs/crypto-fees
   * @see https://files.alpaca.markets/disclosures/library/BrokFeeSched.pdf
   */
  static DEFAULT_FEE_RATES: FeeRate = {
    [OrderType.LIMIT]: new Big(0.0015),
    [OrderType.MARKET]: new Big(0.0025),
  };

  /**
   * Default trading rules for crypto pairs on Alpaca.
   * Use `getTradingRules()` with a live connection for pair-specific values.
   *
   * @see https://docs.alpaca.markets/docs/crypto-trading-1#minimum-order-size
   */
  static DEFAULT_CRYPTO_TRADING_RULES = {
    base_increment: '0.0001',
    base_max_size: Number.MAX_SAFE_INTEGER.toString(),
    base_min_size: '0.0001',
    counter_increment: '0.01',
    counter_min_size: '1',
  };

  async getCandles(pair: TradingPair, request: CandleImportRequest): Promise<Candle[]> {
    return this.#marketData.getCandles(pair, request);
  }

  async getLatestCandle(pair: TradingPair, intervalInMillis: number): Promise<Candle> {
    return this.#marketData.getLatestCandle(pair, intervalInMillis);
  }

  getName(): string {
    return AlpacaBroker.NAME;
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

  async watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string> {
    const topicId = await this.#marketData.watchCandles(pair, intervalInMillis, openTimeInISO);
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
   * Subscribe to real-time order fill updates via Alpaca's trading WebSocket stream.
   * The stream is account-wide and delivers events for all orders.
   * Only `fill` events are emitted as Fill objects.
   *
   * @see https://docs.alpaca.markets/docs/websocket-streaming
   */
  async watchOrders(): Promise<string> {
    const topicId = randomUUID();

    if (!this.#tradingConnectionId) {
      const connection = await this.#connectTradingStream();
      this.#tradingConnectionId = connection.connectionId;
    }

    const cb = (message: TradeUpdateMessage) => {
      if (message.event === TradeUpdateEvent.FILL) {
        const pair = AlpacaBrokerMapper.symbolToPair(message.order.symbol, message.order.asset_class);
        const fill = AlpacaBrokerMapper.toFilledOrder(message.order, pair);
        this.emit(topicId, fill);
      }
    };

    alpacaTradingWebSocket.onTradeUpdate(this.#tradingConnectionId, cb);
    this.#orderTopics.set(topicId, cb);
    return topicId;
  }

  unwatchOrders(topicId: string): void {
    this.removeAllListeners(topicId);
    const cb = this.#orderTopics.get(topicId);
    if (cb && this.#tradingConnectionId) {
      alpacaTradingWebSocket.offTradeUpdate(this.#tradingConnectionId, cb);
      this.#orderTopics.delete(topicId);
    }
  }

  /**
   * Closes the trading WebSocket. The injected `marketData` is owned by the caller and not
   * disconnected here.
   */
  disconnect(): void {
    if (this.#tradingConnectionId) {
      alpacaTradingWebSocket.disconnect(this.#tradingConnectionId);
      this.#tradingConnectionId = null;
    }
    this.#orderTopics.clear();
  }

  async #createReliableSymbol(pair: TradingPair): Promise<string> {
    const isCrypto = await isAlpacaCryptoSymbol(this.#alpacaAPI, pair);
    return createAlpacaSymbol(pair, isCrypto);
  }

  /**
   * Note: The quantity of a position is negative (i.e. -100) if it is a SHORT position.
   *
   * @see https://docs.alpaca.markets/reference/getallopenpositions
   */
  async listBalances(): Promise<Balance[]> {
    const balances: Balance[] = [];

    const positions = await this.#alpacaAPI.getPositions();

    for (const position of positions) {
      const cashSymbol = 'USD';
      // A USDT/USD symbol is returned as "USDTUSD" on Alpaca, so we have to adjust this
      const needsTrimming = position.asset_class === 'crypto' && position.symbol.endsWith(cashSymbol);
      const currency = needsTrimming ? position.symbol.replace(/USD$/, '') : position.symbol;

      let side: OrderPosition;

      if (position.side === PositionSide.LONG) {
        side = OrderPosition.LONG;
      } else if (position.side === PositionSide.SHORT) {
        side = OrderPosition.SHORT;
      } else {
        throw new Error(`Unknown position side "${position.side}" for symbol "${position.symbol}"`);
      }

      balances.push({
        // We are using absolute values here to have positive quantity for SHORT positions
        available: new Big(position.qty).abs().toFixed(),
        currency,
        hold: '0',
        position: side,
      });
    }

    /*
     * The Alpaca exchange handles available portfolio cash within the "Account API"
     * @see https://alpaca.markets/docs/api-references/trading-api/account/
     */
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
      position: OrderPosition.LONG,
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
    try {
      await this.#alpacaAPI.deleteOrder(orderId);
    } catch (error) {
      if (!isAlreadyFilledOrder(error)) {
        throw error;
      }
    }
  }

  /** @see https://docs.alpaca.markets/reference/getallorders */
  async getOpenOrders(pair: TradingPair): Promise<PendingOrder[]> {
    const symbol = await this.#createReliableSymbol(pair);
    const orders = await this.#alpacaAPI.getOrders({status: 'open', symbols: symbol});
    return orders.map(order => AlpacaBrokerMapper.toOpenOrder(order, pair));
  }

  /**
   * @see https://docs.alpaca.markets/reference/getallorders
   */
  async getFills(pair: TradingPair): Promise<Fill[]> {
    const symbol = await this.#createReliableSymbol(pair);
    const orders = await this.#alpacaAPI.getOrders({status: 'closed', symbols: symbol});
    const filledOrders = orders.filter(order => order.status === AlpacaOrderStatus.FILLED);
    return filledOrders.map(order => AlpacaBrokerMapper.toFilledOrder(order, pair));
  }

  async getFillByOrderId(pair: TradingPair, orderId: string): Promise<Fill | undefined> {
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
  async getTradingRules(pair: TradingPair): Promise<TradingRules> {
    const isCrypto = await isAlpacaCryptoSymbol(this.#alpacaAPI, pair);
    const symbol = createAlpacaSymbol(pair, isCrypto);
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
      /*
       * Notional and quantity fields can take up to 9 decimal places:
       * @see https://docs.alpaca.markets/docs/fractional-trading#supported-order-types
       */
      return {
        base_increment: '0.000000001',
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
  async getFeeRates(_pair: TradingPair): Promise<FeeRate> {
    // TODO: Refine according to "30-Day Crypto Volume (USD)" and make fee rate dependant on crypto or stocks
    return AlpacaBroker.DEFAULT_FEE_RATES;
  }

  /**
   * Note: Alpaca supports SHORT orders but does not support holding a LONG & SHORT order simultaneously.
   *
   * @see https://docs.alpaca.markets/docs/working-with-orders#place-new-orders
   */
  protected override async placeOrder(pair: TradingPair, options: LimitOrderOptions): Promise<PendingLimitOrder>;
  protected override async placeOrder(pair: TradingPair, options: MarketOrderOptions): Promise<PendingMarketOrder>;
  protected override async placeOrder(pair: TradingPair, options: OrderOptions): Promise<PendingOrder> {
    const isCrypto = await isAlpacaCryptoSymbol(this.#alpacaAPI, pair);
    const symbol = createAlpacaSymbol(pair, isCrypto);
    /*
     * Crypto orders cannot use 'day' and must be placed with 'gtc' (error code: 42210000)
     * Stock fractional and notional orders must use 'day' (error code: 42210000), whole share orders can use 'gtc'
     * @see https://docs.alpaca.markets/docs/fractional-trading
     */
    const isFractional = options.sizeInCounter || options.size.includes('.');
    const time_in_force = isCrypto || !isFractional ? 'gtc' : 'day';
    const side = options.side === OrderSide.BUY ? 'buy' : 'sell';
    const type = options.type === OrderType.MARKET ? 'market' : 'limit';

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

    if (options.type === OrderType.LIMIT) {
      config.limit_price = options.price;
    }

    // @see https://docs.alpaca.markets/docs/orders-at-alpaca#submitting-an-extended-hours-eligible-order
    const isEligibleForExtendedHours = type === 'limit' && time_in_force === 'day';
    if (isEligibleForExtendedHours) {
      config.extended_hours = true;
    }

    const order = await this.#alpacaAPI.postOrder(config);
    return AlpacaBrokerMapper.toPendingOrder(order, pair, options);
  }
}
