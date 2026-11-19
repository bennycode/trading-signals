import axios, {type AxiosInstance} from 'axios';
import axiosRetry from 'axios-retry';
import {ms} from 'ms';
import {retry} from '../../../util/retry.js';
import {simplifyError} from '../../../util/simplifyError.js';
import {TimeSeriesEnvelopeSchema, TimeSeriesMapSchema, type TimeSeriesMap} from './schema/TimeSeriesSchema.js';

/**
 * The series functions this client supports. Intraday is deliberately absent: its timestamps come
 * back in the exchange's local timezone rather than UTC, which needs zone handling this client does
 * not carry, and daily bars are what a non-US instrument is wanted for here.
 *
 * @see https://www.alphavantage.co/documentation/
 */
export const AlphaVantageFunction = {
  DAILY: 'TIME_SERIES_DAILY',
  WEEKLY: 'TIME_SERIES_WEEKLY',
} as const;
export type AlphaVantageFunction = (typeof AlphaVantageFunction)[keyof typeof AlphaVantageFunction];

/** `full` reaches 20+ years of history but is a premium feature; `compact` returns 100 bars. */
export const AlphaVantageOutputSize = {
  COMPACT: 'compact',
  FULL: 'full',
} as const;
export type AlphaVantageOutputSize = (typeof AlphaVantageOutputSize)[keyof typeof AlphaVantageOutputSize];

export interface AlphaVantageAPIOptions {
  apiKey: string;
}

/**
 * Alpha Vantage states a breached limit in prose rather than in a status code or a header, so the
 * wording is the only thing separating a throttle worth waiting out from a permanent rejection like
 * a premium-only parameter. Matching text is brittle, but there is no other signal to match.
 */
const THROTTLE_PATTERN = /rate limit|requests? per (second|minute|day)|higher API call frequency|spreading out/i;

/**
 * Raised when Alpha Vantage answers HTTP 200 with a message instead of data, which is how it
 * reports a breached rate limit, a premium-only parameter and an unknown symbol alike.
 */
export class AlphaVantageMessageError extends Error {
  /** Whether waiting and asking again could succeed, as opposed to the call being refused outright. */
  readonly isThrottled: boolean;

  constructor(message: string) {
    super(message);
    this.name = 'AlphaVantageMessageError';
    this.isThrottled = THROTTLE_PATTERN.test(message);
  }
}

/** A throttle answered with HTTP 200 is invisible to the default transient-failure check. */
function isThrottled(error: unknown): boolean {
  return error instanceof AlphaVantageMessageError && error.isThrottled;
}

export class AlphaVantageAPI {
  static readonly BASE_URL = 'https://www.alphavantage.co';

  readonly #httpClient: AxiosInstance;
  readonly #apiKey: string;

  constructor(options: AlphaVantageAPIOptions) {
    this.#apiKey = options.apiKey;
    this.#httpClient = axios.create({baseURL: AlphaVantageAPI.BASE_URL});
    axiosRetry(this.#httpClient, {
      retries: 3,
      retryDelay: retryCount => retryCount * ms('1s'),
    });
    simplifyError(this.#httpClient);
  }

  /**
   * Fetches an OHLCV series, newest bar first as Alpha Vantage returns it.
   *
   * The free key limits both bursts and a daily total, and the two are indistinguishable in the
   * response. Attempts are therefore spaced widely but capped, so a per-second burst rides itself
   * out while an exhausted daily quota surfaces within a minute instead of waiting forever.
   *
   * @see https://www.alphavantage.co/documentation/#daily
   * @see https://www.alphavantage.co/documentation/#weekly
   */
  @retry({delayMs: ms('15s'), isRetryable: isThrottled, retries: 3})
  async getTimeSeries(params: {
    function: AlphaVantageFunction;
    outputsize?: AlphaVantageOutputSize;
    symbol: string;
  }): Promise<TimeSeriesMap> {
    const response = await this.#httpClient.get('/query', {
      params: {...params, apikey: this.#apiKey},
    });

    const envelope = TimeSeriesEnvelopeSchema.parse(response.data);
    const message = envelope.Information ?? envelope.Note ?? envelope['Error Message'];
    if (message !== undefined) {
      throw new AlphaVantageMessageError(message);
    }

    /*
     * The series key names the function that produced it, so it cannot be declared up front. Both
     * supported functions return exactly one series alongside the "Meta Data" block.
     */
    const seriesEntry = Object.entries(envelope).find(
      ([key, value]) => key !== 'Meta Data' && typeof value === 'object' && value !== null
    );
    if (seriesEntry === undefined) {
      throw new AlphaVantageMessageError(
        `Alpha Vantage returned no series for symbol "${params.symbol}" and function "${params.function}".`
      );
    }

    return TimeSeriesMapSchema.parse(seriesEntry[1]);
  }
}
