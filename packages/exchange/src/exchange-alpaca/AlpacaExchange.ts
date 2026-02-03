import {ApiError, Client} from '@master-chief/alpaca-ts';
import {ms} from 'ms';
import {retry, RetryConfig} from 'ts-retry-promise';
import {AlpacaExchangeMapper} from './AlpacaExchangeMapper.js';
import {Exchange, ExchangeCandle, ExchangeCandleImportRequest} from '../core/Exchange.js';
import {CurrencyPair} from '../core/CurrencyPair.js';
import {
  AlpacaStream,
  // Alpaca has so many API issues, that we have to use their legacy & beta API concurrently
  // @ts-ignore:next-line
} from 'alpaca-legacy';
import {alpacaWebSocket, AlpacaConnection} from './AlpacaWebSocket.js';
import {CandleBatcher} from '../candle/CandleBatcher.js';
import type {MinuteBarMessage} from './typings.js';

export const hasErrorCode = (error: unknown): error is {code: string | number} => {
  return !!error && typeof error === 'object' && 'code' in error;
};

export const hasErrorStatus = (error: unknown): error is {status: number} => {
  return !!error && typeof error === 'object' && 'status' in error && typeof error.status === 'number';
};

export class AlpacaExchange extends Exchange {
  readonly #stream: AlpacaStream | undefined = undefined;
  readonly client: Client;
  readonly #SUBSCRIPTION_PLAN = 'iex' as const;
  #candleTopics: Map<string, {symbol: string; connectionId: string}> = new Map();
  readonly #connectStream: () => Promise<AlpacaConnection>;
  readonly #retryConfig: Partial<RetryConfig> = {
    delay: ms('10s'),
    retries: 'INFINITELY',
    retryIf: (error: unknown) => {
      if (hasErrorCode(error)) {
        switch (error.code) {
          case 40310100:
            return false;
          default:
            return true;
        }
      } else if (hasErrorStatus(error)) {
        if (error.status === 429) {
          return true;
        }
      }
      return false;
    },
    timeout: ms('5m'),
  } as const;

  constructor(options: {apiKey: string; apiSecret: string; usePaperTrading: boolean}) {
    super(AlpacaExchange.NAME);

    this.client = new Client({
      credentials: {key: options.apiKey, secret: options.apiSecret},
      paper: options.usePaperTrading,
    });

    // Wrap Stream connection, so that nothing async happens when the "constructor" of this class is being called
    this.#connectStream = async (): Promise<AlpacaConnection> => {
      return alpacaWebSocket.connect({
        key: options.apiKey,
        paper: options.usePaperTrading,
        secret: options.apiSecret,
      });
    };
  }

  static NAME = 'Alpaca';

  #createSymbol(pair: CurrencyPair, isCrypto?: boolean): string {
    const effectiveIsCrypto = isCrypto ?? pair.counter !== 'USD';

    if (effectiveIsCrypto) {
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
    return retry(
      () =>
        this.client.v2.getStockBarsLatest({
          feed: this.#SUBSCRIPTION_PLAN,
          symbols: this.#createSymbol(pair, false),
        }),
      this.#retryConfig
    );
  }

  async #fetchLatestCryptoBars(pair: CurrencyPair) {
    return retry(
      () =>
        this.client.v1beta3.getCryptoBarsLatest({
          symbols: this.#createSymbol(pair, true),
        }),
      this.#retryConfig
    );
  }

  async #isCryptoSymbol(pair: CurrencyPair) {
    try {
      const response = await this.#fetchLatestCryptoBars(pair);
      return Object.keys(response.bars).length > 0;
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        return false;
      }
      throw error;
    }
  }

  async #fetchCryptoBars(pair: CurrencyPair, request: ExchangeCandleImportRequest, pageToken: string | undefined) {
    return retry(
      () =>
        this.client.v1beta3.getCryptoBars({
          end: request.startTimeLastCandle,
          limit: 10_000,
          pageToken: pageToken,
          start: request.startTimeFirstCandle,
          symbols: this.#createSymbol(pair, true),
          timeframe: AlpacaExchangeMapper.mapInterval(request.intervalInMillis),
        }),
      this.#retryConfig
    );
  }

  #fetchStockBars(pair: CurrencyPair, request: ExchangeCandleImportRequest, pageToken: string | undefined) {
    if (pair.counter !== 'USD') {
      throw new Error(
        `Cannot use "${pair.counter}". Stock "${pair.base}" can only be traded in USD on ${AlpacaExchange.NAME}.`
      );
    }

    return retry(
      () =>
        this.client.v2.getStockBars({
          end: request.startTimeLastCandle,
          feed: this.#SUBSCRIPTION_PLAN,
          limit: 10_000,
          pageToken: pageToken,
          start: request.startTimeFirstCandle,
          symbols: this.#createSymbol(pair, false),
          timeframe: AlpacaExchangeMapper.mapInterval(request.intervalInMillis),
        }),
      this.#retryConfig
    );
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
    const clock = await retry(() => this.client.v2.getClock(), this.#retryConfig);
    return new Date(clock.timestamp!).toISOString();
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
    const symbol = this.#createSymbol(pair);
    const cb = new CandleBatcher(intervalInMillis);
    const connection = await this.#connectStream();
    alpacaWebSocket.subscribeToBars(connection.connectionId, symbol, (message: MinuteBarMessage) => {
      const isNewer = new Date(message.t).getTime() > new Date(openTimeInISO).getTime();
      if (isNewer) {
        // Bars from Alpaca always come in minutes:
        // https://docs.alpaca.markets/docs/real-time-stock-pricing-data#minute-bars-bars
        const candle = AlpacaExchangeMapper.toExchangeCandle(message, pair, ms('1m'));

        // Emit batched candle (which will match the desired interval)
        const batchedCandle = cb.addToBatch(candle);
        if (batchedCandle) {
          this.emit(topicId, candle);
        }
      }
    });

    this.#candleTopics.set(topicId, {symbol, connectionId: connection.connectionId});
    return topicId;
  }

  disconnect(): void {
    this.#stream?.getConnection().close();
  }
}
