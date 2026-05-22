import {randomUUID} from 'node:crypto';
import {ms} from 'ms';
import {CandleBatcher} from '../../candle/CandleBatcher.js';
import type {Candle, CandleImportRequest} from '../Broker.js';
import {MarketDataSource} from '../MarketDataSource.js';
import type {TradingPair} from '../TradingPair.js';
import {AlpacaBrokerMapper} from './AlpacaBrokerMapper.js';
import {alpacaWebSocket, type AlpacaConnection} from './AlpacaWebSocket.js';
import {AlpacaAPI} from './api/AlpacaAPI.js';
import type {MinuteBarMessage} from './api/schema/StreamSchema.js';
import {createAlpacaSymbol, isAlpacaCryptoSymbol} from './alpacaSymbol.js';

export interface AlpacaMarketDataOptions {
  apiKey: string;
  apiSecret: string;
  usePaperTrading: boolean;
}

/**
 * Alpaca market-data layer: historical bars (`getCandles`, `getLatestCandle`) and the
 * WebSocket-driven candle stream (`watchCandles`). Owns subscriptions to `alpacaWebSocket`
 * and aggregates the always-1-minute Alpaca bars into the requested interval via
 * `CandleBatcher`.
 *
 * Decoupled from `AlpacaBroker` (the brokerage class) so the same provider can feed any
 * broker — e.g. Trading212 paired with Alpaca data for US instruments.
 *
 * @see https://docs.alpaca.markets/docs/real-time-stock-pricing-data
 * @see https://docs.alpaca.markets/docs/real-time-crypto-pricing-data
 */
export class AlpacaMarketData extends MarketDataSource {
  static readonly STOCK_STREAM_SOURCE = 'v2/iex';
  static readonly CRYPTO_STREAM_SOURCE = 'v1beta3/crypto/us';

  readonly #alpacaAPI: AlpacaAPI;
  readonly #SUBSCRIPTION_PLAN = 'iex' as const;
  readonly #connectStream: (source: string) => Promise<AlpacaConnection>;
  readonly #candleTopics = new Map<string, {symbol: string; connectionId: string}>();

  constructor(options: AlpacaMarketDataOptions) {
    super();
    this.#alpacaAPI = new AlpacaAPI(options);
    this.#connectStream = source => alpacaWebSocket.connect(options, source);
  }

  async getCandles(pair: TradingPair, request: CandleImportRequest): Promise<Candle[]> {
    const candles: Candle[] = [];
    let pageToken: string | null | undefined = undefined;

    const isCrypto = await isAlpacaCryptoSymbol(this.#alpacaAPI, pair);
    const fetchBars = isCrypto ? this.#fetchCryptoBars.bind(this) : this.#fetchStockBars.bind(this);

    do {
      const {bars, next_page_token} = await fetchBars(pair, request, pageToken);
      for (const symbolBars of Object.values(bars)) {
        symbolBars.forEach(bar => {
          candles.push(AlpacaBrokerMapper.toCandle(bar, pair, request.intervalInMillis));
        });
      }
      pageToken = next_page_token;
    } while (pageToken);

    return candles;
  }

  async getLatestCandle(pair: TradingPair, intervalInMillis: number): Promise<Candle> {
    const isCrypto = await isAlpacaCryptoSymbol(this.#alpacaAPI, pair);
    const symbol = createAlpacaSymbol(pair, isCrypto);
    const fetchMethod = isCrypto ? this.#fetchLatestCryptoBars.bind(this) : this.#fetchLatestStockBars.bind(this);
    const {bars} = await fetchMethod(pair);
    // Fetch a window large enough to contain at least one bar of the requested interval,
    // then sort by `openTimeInMillis` and return the most recent one. The bars/latest
    // endpoint gives us the latest 1-minute bar's timestamp; we ask `getCandles()` to
    // align that to the requested `intervalInMillis` and return the candle that includes it.
    const latestBarStart = new Date(bars[symbol].t).getTime();
    const startTimeFirstCandle = latestBarStart - intervalInMillis + ms('1m');
    const candles = await this.getCandles(pair, {
      intervalInMillis,
      startTimeFirstCandle: new Date(startTimeFirstCandle).toISOString(),
      startTimeLastCandle: new Date(latestBarStart).toISOString(),
    });

    if (candles.length === 0) {
      throw new Error(`Alpaca returned no candles for ${pair.asString('/')}.`);
    }

    return candles.reduce((latest, candle) => (candle.openTimeInMillis > latest.openTimeInMillis ? candle : latest));
  }

  /**
   * @see https://docs.alpaca.markets/docs/real-time-stock-pricing-data#minute-bars-bars
   */
  async watchCandles(pair: TradingPair, intervalInMillis: number, openTimeInISO: string): Promise<string> {
    const topicId = randomUUID();
    const isCrypto = await isAlpacaCryptoSymbol(this.#alpacaAPI, pair);
    const symbol = createAlpacaSymbol(pair, isCrypto);
    const source = isCrypto ? AlpacaMarketData.CRYPTO_STREAM_SOURCE : AlpacaMarketData.STOCK_STREAM_SOURCE;
    const cb = new CandleBatcher(intervalInMillis);
    const connection = await this.#connectStream(source);
    const smallestInterval = ms('1m');

    alpacaWebSocket.subscribeToBars(connection.connectionId, symbol, (message: MinuteBarMessage) => {
      const isNewer = new Date(message.t).getTime() > new Date(openTimeInISO).getTime();
      if (!isNewer) {
        return;
      }
      const candle = AlpacaBrokerMapper.toCandle(message, pair, smallestInterval);
      if (intervalInMillis === smallestInterval) {
        this.emit(topicId, candle);
        return;
      }
      const batchedCandle = cb.addToBatch(candle);
      if (batchedCandle) {
        this.emit(topicId, batchedCandle);
      }
    });

    this.#candleTopics.set(topicId, {connectionId: connection.connectionId, symbol});
    return topicId;
  }

  unwatchCandles(topicId: string): void {
    this.removeAllListeners(topicId);
    const topic = this.#candleTopics.get(topicId);
    if (topic) {
      alpacaWebSocket.unsubscribeFromBars(topic.connectionId, topic.symbol);
      this.#candleTopics.delete(topicId);
    }
  }

  disconnect(): void {
    for (const topic of this.#candleTopics.values()) {
      alpacaWebSocket.unsubscribeFromBars(topic.connectionId, topic.symbol);
    }
    this.#candleTopics.clear();
  }

  #fetchLatestStockBars(pair: TradingPair) {
    return this.#alpacaAPI.getStockBarsLatest({
      feed: this.#SUBSCRIPTION_PLAN,
      symbols: createAlpacaSymbol(pair, false),
    });
  }

  #fetchLatestCryptoBars(pair: TradingPair) {
    return this.#alpacaAPI.getCryptoBarsLatest({
      symbols: createAlpacaSymbol(pair, true),
    });
  }

  #fetchCryptoBars(pair: TradingPair, request: CandleImportRequest, pageToken: string | undefined) {
    return this.#alpacaAPI.getCryptoBars({
      end: request.startTimeLastCandle,
      limit: 10_000,
      page_token: pageToken,
      start: request.startTimeFirstCandle,
      symbols: createAlpacaSymbol(pair, true),
      timeframe: AlpacaBrokerMapper.mapInterval(request.intervalInMillis),
    });
  }

  #fetchStockBars(pair: TradingPair, request: CandleImportRequest, pageToken: string | undefined) {
    if (pair.counter !== 'USD') {
      throw new Error(`Cannot use "${pair.counter}". Stock "${pair.base}" can only be traded in USD on Alpaca.`);
    }
    return this.#alpacaAPI.getStockBars({
      end: request.startTimeLastCandle,
      feed: this.#SUBSCRIPTION_PLAN,
      limit: 10_000,
      page_token: pageToken,
      start: request.startTimeFirstCandle,
      symbols: createAlpacaSymbol(pair, false),
      timeframe: AlpacaBrokerMapper.mapInterval(request.intervalInMillis),
    });
  }
}
