import type {TradingPair} from '../TradingPair.js';
import type {IbkrAPI} from './api/IbkrAPI.js';

/**
 * Resolves tickers to IBKR's numeric contract ids and remembers them.
 *
 * Shared by {@link IbkrBroker} and {@link IbkrMarketData} so a symbol is looked up once per
 * process and both agree on which listing a pair means.
 */
export class IbkrConidResolver {
  readonly #api: IbkrAPI;
  readonly #conidByBase = new Map<string, Promise<number>>();

  constructor(api: IbkrAPI) {
    this.#api = api;
  }

  /**
   * The search returns one entry per listing, so a bare "first result" would pick a foreign
   * listing of the same ticker at random. This keeps only exact symbol matches that offer a plain
   * stock section.
   */
  async getConid(pair: TradingPair): Promise<number> {
    const cached = this.#conidByBase.get(pair.base);
    if (cached) {
      return cached;
    }

    const lookup = (async () => {
      const results = await this.#api.searchContracts(pair.base);
      const exactMatches = results.filter(result => result.symbol?.toUpperCase() === pair.base.toUpperCase());
      const candidates = exactMatches.length > 0 ? exactMatches : results;

      const tradable = candidates.filter(candidate => candidate.sections?.some(section => section.secType === 'STK'));
      const chosen = (tradable.length > 0 ? tradable : candidates)[0];

      if (!chosen) {
        throw new Error(`IBKR has no contract for symbol "${pair.base}".`);
      }

      return Number(chosen.conid);
    })();

    this.#conidByBase.set(pair.base, lookup);

    // A failed lookup must not be cached, or a transient error poisons the symbol for the process.
    lookup.catch(() => this.#conidByBase.delete(pair.base));

    return lookup;
  }
}
