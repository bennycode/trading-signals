import {ApiError, Client} from '@master-chief/alpaca-ts';
import {retry, RetryConfig} from 'ts-retry-promise';
import {AlpacaExchangeMapper} from './AlpacaExchangeMapper.js';
import {Exchange, ExchangeCandle, ExchangeCandleImportRequest} from '../core/Exchange.js';
import {CurrencyPair} from '../core/CurrencyPair.js';
import {
  AlpacaStream,
  // Alpaca has so many API issues, that we have to use their legacy & beta API concurrently
  // @ts-ignore:next-line
} from 'alpaca-legacy';

const ms = (timeString: string): number => {
  const units: Record<string, number> = {
    s: 1000,
    m: 60000,
  };
  const match = timeString.match(/^(\d+)([sm])$/);
  if (!match) throw new Error(`Invalid time string: ${timeString}`);
  return parseInt(match[1]) * units[match[2]];
};

export const hasErrorCode = (error: unknown): error is {code: string | number} => {
  return !!error && typeof error === 'object' && 'code' in error;
};

export const hasErrorStatus = (error: unknown): error is {status: number} => {
  return !!error && typeof error === 'object' && 'status' in error && typeof error.status === 'number';
};

export class AlpacaExchange extends Exchange {
  private readonly stream: AlpacaStream | undefined = undefined;
  readonly client: Client;
  private readonly SUBSCRIPTION_PLAN = 'iex' as const;
  private readonly retryConfig: Partial<RetryConfig> = {
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
  }

  static NAME = 'Alpaca';

  private createSymbol(pair: CurrencyPair, isCrypto: boolean = pair.counter !== 'USD'): string {
    if (isCrypto) {
      return `${pair.base}/${pair.counter}`;
    }
    return pair.base;
  }

  private async fetchLatestCryptoBars(pair: CurrencyPair) {
    return retry(
      () =>
        this.client.v1beta3.getCryptoBarsLatest({
          symbols: this.createSymbol(pair, true),
        }),
      this.retryConfig
    );
  }

  private async isCryptoSymbol(pair: CurrencyPair) {
    try {
      const response = await this.fetchLatestCryptoBars(pair);
      return Object.keys(response.bars).length > 0;
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        return false;
      }
      throw error;
    }
  }

  private async fetchCryptoBars(
    pair: CurrencyPair,
    request: ExchangeCandleImportRequest,
    pageToken: string | undefined
  ) {
    return retry(
      () =>
        this.client.v1beta3.getCryptoBars({
          end: request.startTimeLastCandle,
          limit: 10_000,
          pageToken: pageToken,
          start: request.startTimeFirstCandle,
          symbols: this.createSymbol(pair, true),
          timeframe: AlpacaExchangeMapper.mapInterval(request.intervalInMillis),
        }),
      this.retryConfig
    );
  }

  private fetchStockBars(pair: CurrencyPair, request: ExchangeCandleImportRequest, pageToken: string | undefined) {
    if (pair.counter !== 'USD') {
      throw new Error(
        `Cannot use "${pair.counter}". Stock "${pair.base}" can only be traded in USD on ${this.getName()}.`
      );
    }

    return retry(
      () =>
        this.client.v2.getStockBars({
          end: request.startTimeLastCandle,
          feed: this.SUBSCRIPTION_PLAN,
          limit: 10_000,
          pageToken: pageToken,
          start: request.startTimeFirstCandle,
          symbols: this.createSymbol(pair, false),
          timeframe: AlpacaExchangeMapper.mapInterval(request.intervalInMillis),
        }),
      this.retryConfig
    );
  }

  async getCandles(pair: CurrencyPair, request: ExchangeCandleImportRequest): Promise<ExchangeCandle[]> {
    const candles: ExchangeCandle[] = [];
    let pageToken: string | null | undefined = undefined;

    const isCrypto = await this.isCryptoSymbol(pair);

    const fetchBars = isCrypto ? this.fetchCryptoBars.bind(this) : this.fetchStockBars.bind(this);

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

  /**
   * Original time format from Alpaca is "RFC 3339" (i.e. "2023-08-08T18:58:27.26720022-04:00"),
   * we convert it to "ISO 8601 UTC" (i.e. "2023-08-08T22:58:27.267Z").
   */
  async getTime(): Promise<string> {
    const clock = await retry(() => this.client.v2.getClock(), this.retryConfig);
    return new Date(clock.timestamp!).toISOString();
  }

  disconnect(): void {
    this.stream?.getConnection().close();
  }
}
