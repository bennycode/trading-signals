import axios, {type AxiosInstance} from 'axios';
import {ms} from 'ms';
import {retry} from '../../../util/retry.js';
import {simplifyError} from '../../../util/simplifyError.js';
import {EodBarsSchema, type EodBar} from './schema/EodSchema.js';

/**
 * Bar sizes the end-of-day endpoint aggregates to. Weekly and monthly bars are derived from the
 * daily ones, spanning the period's OHLC and summing its volume.
 */
export const EODHDPeriod = {
  DAILY: 'd',
  MONTHLY: 'm',
  WEEKLY: 'w',
} as const;
export type EODHDPeriod = (typeof EODHDPeriod)[keyof typeof EODHDPeriod];

const PERIODS: ReadonlySet<string> = new Set(Object.values(EODHDPeriod));
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface EODHDAPIOptions {
  apiKey: string;
}

export interface GetEodRequest {
  /** `YYYY-MM-DD`. Left out together with `to`, the instrument's entire history comes back. */
  from?: string;
  period: EODHDPeriod;
  /** Exchange-suffixed, e.g. `ALV.XETRA` or `AAPL.US`. */
  symbol: string;
  /** `YYYY-MM-DD`. */
  to?: string;
}

export class EODHDAPI {
  static readonly BASE_URL = 'https://eodhd.com';

  readonly #httpClient: AxiosInstance;
  readonly #apiKey: string;

  constructor(options: EODHDAPIOptions) {
    this.#apiKey = options.apiKey;
    this.#httpClient = axios.create({baseURL: EODHDAPI.BASE_URL});
    simplifyError(this.#httpClient);
  }

  /**
   * Fetches end-of-day bars, oldest first.
   *
   * Every argument is checked before the call goes out, because EODHD does not reject a bad one: an
   * unknown `period` or a misspelled date is quietly replaced by a default or reinterpreted, so the
   * response is plausible data for a window nobody asked for. A rejected request, by contrast, does
   * come back as a real status code, so transient failures need no special handling here. Note that
   * an unknown symbol answers 404 and still counts against the quota.
   *
   * @see https://eodhd.com/financial-apis/api-for-historical-data-and-volumes
   */
  @retry({delayMs: ms('2s'), retries: 3})
  async getEod(request: GetEodRequest): Promise<EodBar[]> {
    if (!PERIODS.has(request.period)) {
      throw new Error(
        `EODHD silently falls back to daily bars for an unknown period, so "${request.period}" is refused here.`
      );
    }

    for (const [name, value] of [
      ['from', request.from],
      ['to', request.to],
    ] as const) {
      if (value !== undefined && !DATE_PATTERN.test(value)) {
        throw new Error(
          `EODHD reinterprets a date it cannot read instead of refusing it, so "${name}" has to be YYYY-MM-DD, not "${value}".`
        );
      }
    }

    const response = await this.#httpClient.get(`/api/eod/${request.symbol}`, {
      params: {
        api_token: this.#apiKey,
        fmt: 'json',
        from: request.from,
        order: 'a',
        period: request.period,
        to: request.to,
      },
    });

    return EodBarsSchema.parse(response.data);
  }
}
