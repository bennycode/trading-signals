import axios from 'axios';
import axiosRetry from 'axios-retry';
import {ms} from 'ms';
import {simplifyError} from '../../util/simplifyError.js';
import {CompanyConceptSchema} from './schema/CompanyConceptSchema.js';
import {CompanyTickersSchema} from './schema/CompanyTickersSchema.js';

/**
 * Free, keyless access to the financial statements US companies file with the SEC. Every value
 * carries the day it was filed, so a screen can use only what was public at the time.
 *
 * The SEC answers anonymous traffic with a rate-limit page, so it asks every client to identify
 * itself with a name and a contact email, e.g. "Sample Company admin@example.com".
 *
 * @see https://www.sec.gov/search-filings/edgar-application-programming-interfaces
 * @see https://www.sec.gov/about/developer-resources
 */
export class SecEdgarAPI {
  readonly #client;

  constructor(options: {userAgent: string}) {
    this.#client = axios.create({headers: {'User-Agent': options.userAgent}});
    // The SEC allows ten requests per second and answers bursts with HTTP 429.
    axiosRetry(this.#client, {retries: 5, retryDelay: retryCount => retryCount * ms('1s')});
    simplifyError(this.#client);
  }

  /**
   * Maps each listed ticker to the Central Index Key the SEC files companies under.
   *
   * @see https://www.sec.gov/file/company-tickers
   */
  async getCompanyTickers() {
    const response = await this.#client.get('https://www.sec.gov/files/company_tickers.json');
    const companies = Object.values(CompanyTickersSchema.parse(response.data));
    return new Map(companies.map(company => [company.ticker, company.cik_str]));
  }

  /**
   * Every value a company reported for one tag, across all its filings. Resolves to null when the
   * company never reported the tag, which the SEC answers with HTTP 404.
   *
   * @see https://www.sec.gov/search-filings/edgar-application-programming-interfaces
   */
  async getCompanyConcept(cik: number, taxonomy: string, tag: string) {
    const paddedCik = String(cik).padStart(10, '0');
    const response = await this.#client.get(
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${paddedCik}/${taxonomy}/${tag}.json`,
      {validateStatus: status => status === 200 || status === 404}
    );
    return response.status === 404 ? null : CompanyConceptSchema.parse(response.data);
  }
}
