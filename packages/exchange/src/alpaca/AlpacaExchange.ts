import axios from 'axios';
import {ms} from 'ms';
import {AlpacaExchangeMapper} from './AlpacaExchangeMapper.js';
import {Exchange, ExchangeCandle, ExchangeCandleImportRequest} from '../core/Exchange.js';
import {CurrencyPair} from '../core/CurrencyPair.js';
import {alpacaWebSocket, AlpacaConnection} from './AlpacaWebSocket.js';
import {CandleBatcher} from '../candle/CandleBatcher.js';
import type {MinuteBarMessage} from './api/schema/StreamSchema.js';
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

  #createSymbol(pair: CurrencyPair, isCrypto: boolean): string {
    if (isCrypto) {
      return `${pair.base}/${pair.counter}`;
    }
    return pair.base;
  }

  async getLatestCandle(pair: CurrencyPair, intervalInMillis: number): Promise<ExchangeCandle> {
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

  async #fetchLatestStockBars(pair: CurrencyPair) {
    return this.#alpacaAPI.getStockBarsLatest({
      feed: this.#SUBSCRIPTION_PLAN,
      symbols: this.#createSymbol(pair, false),
    });
  }

  async #fetchLatestCryptoBars(pair: CurrencyPair) {
    return this.#alpacaAPI.getCryptoBarsLatest({
      symbols: this.#createSymbol(pair, true),
    });
  }

  async #isCryptoSymbol(pair: CurrencyPair) {
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

  async #fetchCryptoBars(pair: CurrencyPair, request: ExchangeCandleImportRequest, pageToken: string | undefined) {
    return this.#alpacaAPI.getCryptoBars({
      end: request.startTimeLastCandle,
      limit: 10_000,
      page_token: pageToken,
      start: request.startTimeFirstCandle,
      symbols: this.#createSymbol(pair, true),
      timeframe: AlpacaExchangeMapper.mapInterval(request.intervalInMillis),
    });
  }

  #fetchStockBars(pair: CurrencyPair, request: ExchangeCandleImportRequest, pageToken: string | undefined) {
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

  async getCandles(pair: CurrencyPair, request: ExchangeCandleImportRequest): Promise<ExchangeCandle[]> {
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
  async watchCandles(pair: CurrencyPair, intervalInMillis: number, openTimeInISO: string): Promise<string> {
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
}
