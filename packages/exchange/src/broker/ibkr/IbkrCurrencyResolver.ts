import type {IbkrAPI} from './api/IbkrAPI.js';

/**
 * Works out which currency an IBKR figure is in, and remembers the answers.
 *
 * Two different questions live here. The account currency is what a trade's funds come from. The
 * instrument currency is what a contract quotes in, which a trade payload does not carry at all —
 * and the two differ routinely, since IBKR quotes a US stock in USD from a EUR account.
 */
export class IbkrCurrencyResolver {
  /** IBKR's own default when nothing else identifies a currency. */
  static readonly FALLBACK = 'USD';

  readonly #api: IbkrAPI;
  readonly #getAccountId: () => Promise<string>;
  readonly #byConid = new Map<number, string>();
  #accountCurrency?: string;

  constructor(input: {api: IbkrAPI; getAccountId: () => Promise<string>}) {
    this.#api = input.api;
    this.#getAccountId = input.getAccountId;
  }

  /**
   * The currency the account settles in, which is where a trade's funds come from but is *not*
   * what fees are denominated in — IBKR bills a US stock in USD from a EUR account, so fees
   * follow `pair.counter`. Cached because it never changes.
   */
  async getAccountCurrency(): Promise<string | undefined> {
    if (this.#accountCurrency) {
      return this.#accountCurrency;
    }

    const accountId = await this.#getAccountId();
    const accounts = await this.#api.getPortfolioAccounts().catch(() => []);
    const currency = accounts.find(account => account.id === accountId)?.currency;

    if (currency) {
      this.#accountCurrency = currency;
    }

    return currency ?? undefined;
  }

  /**
   * The currency an instrument quotes in, needed to build the `TradingPair` on a streamed fill:
   * guessing the account currency would mislabel every US instrument held in a EUR account.
   *
   * Only a currency IBKR actually returned is cached. Storing the fallback would make one
   * transient lookup failure permanent, labelling every later fill for that contract `F/EUR`
   * instead of `F/USD` until the process restarts — exactly the mislabelling this exists to
   * prevent, and the same trap {@link IbkrConidResolver} already avoids.
   */
  async getQuoteCurrency(conid: string | number | null | undefined): Promise<string> {
    const fallback = (await this.getAccountCurrency()) ?? IbkrCurrencyResolver.FALLBACK;

    if (conid === null || conid === undefined) {
      return fallback;
    }

    const key = Number(conid);
    const cached = this.#byConid.get(key);
    if (cached) {
      return cached;
    }

    const info = await this.#api.getContractInfoAndRules(key).catch(() => undefined);

    if (info?.currency) {
      this.#byConid.set(key, info.currency);
      return info.currency;
    }

    return fallback;
  }
}
