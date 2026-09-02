import axios, {type AxiosInstance} from 'axios';
import axiosRetry from 'axios-retry';
import Big from 'big.js';
import {ms} from 'ms';
import {z} from 'zod';
import {SEC_FEE_RATES, type DatedRate} from './AlpacaFees.js';

/**
 * Keeps {@link SEC_FEE_RATES} current by reading the SEC's Section 31 orders from the Federal
 * Register, which publishes them as structured documents.
 *
 * The vendored table stays the source of truth and the fallback. A fetch can only ever *append* a
 * window that starts after the newest known one, never rewrite an existing rate, so a fill that is
 * already priced today prices the same tomorrow. Every failure mode — no network, a changed
 * document layout, an implausible number — leaves the vendored table in place rather than
 * guessing.
 *
 * @see https://www.federalregister.gov/developers/documentation/api/v1
 */

const DOCUMENTS_ENDPOINT = 'https://www.federalregister.gov/api/v1/documents.json';

/** The SEC titles every annual Section 31 order this way. */
const SEARCH_TERM = 'Annual Adjustments to Transaction Fee Rates';

/**
 * The operative sentence of the order, and the only place the adopted rate and its effective date
 * appear together.
 *
 * Anchoring on it is what makes parsing safe. The surrounding prose quotes two or three other
 * rates — the outgoing one, and the raw output of the SEC's formula — and picking the wrong one is
 * not hypothetical: the FY2025 order computes -$23.40 per million, explains that a negative fee
 * rate cannot be effectuated, and orders $0.00. Only this sentence says $0.00.
 *
 * Verified against every order from FY2020 to FY2026. Correction notices do not contain it and are
 * skipped, which is the behaviour we want: they amend the methodology appendix, not the rate.
 */
const ORDERED_RATE_PATTERN =
  /it is hereby ordered that the fee rates? applicable under sections? 31\(b\) and \(c\) of the exchange act shall be \$(?<perMillion>\d+(?:\.\d+)?) per \$1,000,000 effective on (?<month>[A-Za-z]+) (?<day>\d{1,2}), (?<year>\d{4})/i;

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/**
 * Rejects a parse that produced a number no Section 31 rate has ever approached. The highest on
 * record is $27.80 per million, so this only fires when the document layout has changed underneath
 * the pattern.
 */
const MAX_PLAUSIBLE_PER_MILLION = new Big(100);

const DocumentSchema = z.looseObject({
  document_number: z.string(),
  publication_date: z.string(),
  raw_text_url: z.string().nullable(),
});

/** The API omits `results` entirely when nothing matches. */
const SearchResponseSchema = z.looseObject({
  results: z.array(DocumentSchema).optional(),
});

/**
 * Extracts the rate a Section 31 order puts into force.
 *
 * Returns `undefined` for anything that does not carry the operative sentence, or whose numbers
 * fail a sanity check — callers keep their existing table in that case.
 */
export function parseSecFeeRateOrder(documentText: string): DatedRate | undefined {
  const groups = ORDERED_RATE_PATTERN.exec(documentText.replace(/\s+/g, ' '))?.groups;

  if (!groups?.perMillion || !groups.month || !groups.day || !groups.year) {
    return undefined;
  }

  const monthIndex = MONTHS.indexOf(groups.month.toLowerCase());

  if (monthIndex === -1) {
    return undefined;
  }

  const perMillion = new Big(groups.perMillion);

  if (perMillion.gt(MAX_PLAUSIBLE_PER_MILLION)) {
    return undefined;
  }

  const month = `${monthIndex + 1}`.padStart(2, '0');
  const day = groups.day.padStart(2, '0');

  return {from: `${groups.year}-${month}-${day}`, rate: perMillion.div(1_000_000)};
}

export class SecFeeRateSource {
  /** How long a refresh is considered fresh. The SEC adjusts the rate once a year. */
  static readonly DEFAULT_TTL = ms('12h');

  readonly #client: AxiosInstance;
  readonly #ttl: number;
  #rates: readonly DatedRate[] = SEC_FEE_RATES;
  #refreshedAt = 0;

  constructor(options: {client?: AxiosInstance; ttl?: number} = {}) {
    this.#ttl = options.ttl ?? SecFeeRateSource.DEFAULT_TTL;
    this.#client = options.client ?? axios.create({timeout: ms('10s')});

    if (!options.client) {
      axiosRetry(this.#client, {retries: 2, retryDelay: axiosRetry.exponentialDelay});
    }
  }

  /** The table as it stands: the vendored windows plus anything a refresh has appended. */
  getRates(): readonly DatedRate[] {
    return this.#rates;
  }

  /**
   * Appends any Section 31 order published since the newest known window.
   *
   * Never throws and never blocks a second caller within the TTL, because this runs alongside
   * order mapping: a fee estimate worth fractions of a cent must not be able to fail a fill.
   * Returns the windows it added, which is usually none.
   */
  async refresh(now = Date.now()): Promise<DatedRate[]> {
    if (this.#refreshedAt && now - this.#refreshedAt < this.#ttl) {
      return [];
    }
    this.#refreshedAt = now;

    try {
      return this.#merge(await this.#fetchOrdersSince(this.#newestWindow().from));
    } catch (error) {
      console.warn('Could not refresh SEC fee rates, keeping the vendored table:', error);
      return [];
    }
  }

  #newestWindow(): DatedRate {
    const newest = this.#rates.at(-1);

    if (!newest) {
      throw new Error('The SEC fee rate table is empty.');
    }

    return newest;
  }

  /**
   * An order is always published before it takes effect, so filtering on the newest known
   * *effective* date excludes the order that produced it while still catching its successor.
   */
  async #fetchOrdersSince(publishedFrom: string): Promise<DatedRate[]> {
    const response = await this.#client.get(DOCUMENTS_ENDPOINT, {
      params: {
        'conditions[agencies][]': 'securities-and-exchange-commission',
        'conditions[publication_date][gte]': publishedFrom,
        'conditions[term]': `"${SEARCH_TERM}"`,
        'fields[]': ['document_number', 'publication_date', 'raw_text_url'],
        order: 'newest',
        per_page: 5,
      },
    });

    const documents = SearchResponseSchema.parse(response.data).results ?? [];
    const parsed: DatedRate[] = [];

    for (const document of documents) {
      if (!document.raw_text_url) {
        continue;
      }
      const text = await this.#client.get(document.raw_text_url, {responseType: 'text'});
      const rate = parseSecFeeRateOrder(String(text.data));

      if (rate) {
        parsed.push(rate);
      }
    }

    return parsed;
  }

  /** Append-only: a window that would rewrite history is dropped, so past fills stay reproducible. */
  #merge(candidates: DatedRate[]): DatedRate[] {
    const newest = this.#newestWindow();
    const added = candidates
      .filter(candidate => candidate.from > newest.from)
      .sort((a, b) => a.from.localeCompare(b.from));

    if (added.length > 0) {
      this.#rates = [...this.#rates, ...added];
    }

    return added;
  }
}
