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
  /**
   * Keyed by the whole pair, not by its base. Two listings can share a ticker and quote in
   * different currencies, and a base-only key would hand `F/EUR` whatever `F/USD` resolved to
   * first — an order for a different instrument, with its prices and fees labelled in the
   * currency that was asked for rather than the one it trades in.
   */
  readonly #conidByPair = new Map<string, Promise<number>>();

  constructor(api: IbkrAPI) {
    this.#api = api;
  }

  /**
   * The search returns one entry per listing, so a bare "first result" would pick a foreign
   * listing of the same ticker at random.
   *
   * Nothing is accepted on a near miss: the symbol must match exactly, the listing must offer a
   * plain stock section, and its contract currency must be the pair's counter. Falling back to a
   * partial match would place an order for an instrument the caller never named, which is worse
   * than failing, so an unresolved pair throws.
   */
  async getConid(pair: TradingPair): Promise<number> {
    const key = `${pair.base.toUpperCase()}/${pair.counter.toUpperCase()}`;
    const cached = this.#conidByPair.get(key);
    if (cached) {
      return cached;
    }

    const lookup = this.#resolve(pair);
    this.#conidByPair.set(key, lookup);

    // A failed lookup must not be cached, or a transient error poisons the symbol for the process.
    lookup.catch(() => this.#conidByPair.delete(key));

    return lookup;
  }

  async #resolve(pair: TradingPair): Promise<number> {
    const results = await this.#api.searchContracts(pair.base);

    const candidates = results.filter(
      result =>
        result.symbol?.toUpperCase() === pair.base.toUpperCase() &&
        result.sections?.some(section => section.secType === 'STK')
    );

    if (candidates.length === 0) {
      throw new Error(`IBKR lists no stock with the exact symbol "${pair.base}".`);
    }

    /*
     * The search result carries no currency, so the only way to tell two same-ticker listings
     * apart is to ask about each contract. One candidate is the common case and costs one call.
     */
    for (const candidate of candidates) {
      const conid = Number(candidate.conid);
      const info = await this.#api.getContractInfoAndRules(conid).catch(() => undefined);

      if (info?.currency?.toUpperCase() === pair.counter.toUpperCase()) {
        return conid;
      }
    }

    throw new Error(
      `IBKR lists ${candidates.length} stock contract(s) for "${pair.base}", none quoting in ${pair.counter}. Name the currency the instrument actually trades in.`
    );
  }
}
