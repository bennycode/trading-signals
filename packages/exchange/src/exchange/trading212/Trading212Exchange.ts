import Big from 'big.js';
import {ms} from 'ms';
import {
  Exchange,
  ExchangeOrderPosition,
  ExchangeOrderSide,
  ExchangeOrderType,
  type ExchangeBalance,
  type ExchangeCandle,
  type ExchangeCandleImportRequest,
  type ExchangeFeeRate,
  type ExchangeFill,
  type ExchangeLimitOrderOptions,
  type ExchangeMarketOrderOptions,
  type ExchangeOrderOptions,
  type ExchangePendingLimitOrder,
  type ExchangePendingMarketOrder,
  type ExchangePendingOrder,
  type ExchangeTradingRules,
} from '../Exchange.js';
import {TradingPair} from '../TradingPair.js';
import {Trading212API} from './api/Trading212API.js';
import {Trading212OrderStatus, Trading212TimeValidity} from './api/schema/OrderSchema.js';
import {Trading212ExchangeMapper} from './Trading212ExchangeMapper.js';

const NOT_SUPPORTED = 'Trading212 does not provide this capability via its public API.';

export class Trading212Exchange extends Exchange {
  static readonly NAME = 'Trading212';

  /**
   * Trading212 charges 0% commission on equity trades. Currency-conversion fees apply on
   * trades whose instrument currency differs from the account currency, but those are
   * charged per-fill via `taxes` rather than as a fixed maker/taker rate.
   *
   * @see https://helpcentre.trading212.com/hc/en-us/articles/360008842317
   */
  static readonly DEFAULT_FEE_RATES: ExchangeFeeRate = {
    [ExchangeOrderType.MARKET]: new Big(0),
    [ExchangeOrderType.LIMIT]: new Big(0),
  };

  readonly #api: Trading212API;

  constructor(options: {apiKey: string; apiSecret: string; usePaperTrading: boolean}) {
    super(Trading212Exchange.NAME);
    this.#api = new Trading212API(options);
  }

  getName(): string {
    return Trading212Exchange.NAME;
  }

  /**
   * Trading212 has no historical-bar endpoint, but the `Exchange` contract requires a value.
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

  async getCandles(_pair: TradingPair, _request: ExchangeCandleImportRequest): Promise<ExchangeCandle[]> {
    throw new Error(`getCandles: ${NOT_SUPPORTED}`);
  }

  async getLatestCandle(_pair: TradingPair, _intervalInMillis: number): Promise<ExchangeCandle> {
    throw new Error(`getLatestCandle: ${NOT_SUPPORTED}`);
  }

  async watchCandles(_pair: TradingPair, _intervalInMillis: number, _openTimeInISO: string): Promise<string> {
    throw new Error(`watchCandles: ${NOT_SUPPORTED}`);
  }

  unwatchCandles(_topicId: string): void {
    throw new Error(`unwatchCandles: ${NOT_SUPPORTED}`);
  }

  async watchOrders(): Promise<string> {
    throw new Error(`watchOrders: ${NOT_SUPPORTED}`);
  }

  unwatchOrders(_topicId: string): void {
    throw new Error(`unwatchOrders: ${NOT_SUPPORTED}`);
  }

  disconnect(): void {
    // Trading212 has no persistent connections to close.
  }

  /**
   * Lists open positions plus account cash. Position currency is the Trading212 ticker
   * (e.g. "AAPL_US_EQ"); account cash uses the account's `currencyCode` (e.g. "EUR").
   */
  async listBalances(): Promise<ExchangeBalance[]> {
    const [positions, cash, accountInfo] = await Promise.all([
      this.#api.getPositions(),
      this.#api.getAccountCash(),
      this.#api.getAccountInfo(),
    ]);

    const balances: ExchangeBalance[] = positions.map(position => ({
      available: new Big(position.quantity).abs().toFixed(),
      currency: position.ticker,
      hold: '0',
      position: position.quantity < 0 ? ExchangeOrderPosition.SHORT : ExchangeOrderPosition.LONG,
    }));

    balances.push({
      available: new Big(cash.free).toFixed(),
      currency: accountInfo.currencyCode,
      hold: new Big(cash.blocked ?? 0).toFixed(),
      position: ExchangeOrderPosition.LONG,
    });

    return balances;
  }

  async getOpenOrders(pair: TradingPair): Promise<ExchangePendingOrder[]> {
    const orders = await this.#api.getOrders();
    return orders
      .filter(order => order.ticker === pair.base)
      .map(order => Trading212ExchangeMapper.toOpenOrder(order, pair));
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

  async getFills(pair: TradingPair): Promise<ExchangeFill[]> {
    const history = await this.#api.getHistoryOrders(pair.base);
    return history
      .filter(order => order.id != null && order.status === Trading212OrderStatus.FILLED)
      .map(order => Trading212ExchangeMapper.toFilledOrder(order, pair));
  }

  async getFillByOrderId(pair: TradingPair, orderId: string): Promise<ExchangeFill | undefined> {
    const fills = await this.getFills(pair);
    return fills.find(fill => fill.order_id === orderId);
  }

  async getTradingRules(pair: TradingPair): Promise<ExchangeTradingRules> {
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

    return {
      base_increment: `${instrument.minTradeQuantity ?? '0.000000001'}`,
      base_max_size: `${instrument.maxOpenQuantity ?? Number.MAX_SAFE_INTEGER}`,
      base_min_size: `${instrument.minTradeQuantity ?? '0'}`,
      counter_increment: '0.01',
      counter_min_size: '1',
      pair,
    };
  }

  async getFeeRates(_pair: TradingPair): Promise<ExchangeFeeRate> {
    return Trading212Exchange.DEFAULT_FEE_RATES;
  }

  protected override async placeOrder(
    pair: TradingPair,
    options: ExchangeLimitOrderOptions
  ): Promise<ExchangePendingLimitOrder>;
  protected override async placeOrder(
    pair: TradingPair,
    options: ExchangeMarketOrderOptions
  ): Promise<ExchangePendingMarketOrder>;
  protected override async placeOrder(pair: TradingPair, options: ExchangeOrderOptions): Promise<ExchangePendingOrder> {
    if (options.sizeInCounter) {
      throw new Error('Notional (sizeInCounter) orders are not supported by the Trading212 public API.');
    }

    // Trading212 encodes side in the sign of `quantity`: positive = BUY, negative = SELL.
    const signedQuantity = options.side === ExchangeOrderSide.SELL ? -Number(options.size) : Number(options.size);

    if (options.type === ExchangeOrderType.LIMIT) {
      // Trading212 rejects GTC for stock limit orders ("Invalid payload"). DAY is the only
      // time-in-force that works across paper and live for equity limit orders.
      const order = await this.#api.placeLimitOrder({
        limitPrice: Number(options.price),
        quantity: signedQuantity,
        ticker: pair.base,
        timeValidity: Trading212TimeValidity.DAY,
      });
      return Trading212ExchangeMapper.toExchangePendingOrder(order, pair, options);
    }

    const order = await this.#api.placeMarketOrder({
      quantity: signedQuantity,
      ticker: pair.base,
    });
    return Trading212ExchangeMapper.toExchangePendingOrder(order, pair, options);
  }
}
