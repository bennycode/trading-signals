/**
 * Serialized version of a currency pair.
 */
export type CurrencyPairJSON = {
  base: string;
  counter: string;
};

/**
 * A currency pair symbolizes an asset and the currency that you are trading the asset with.
 *
 * Examples:
 * Base: TSLA, Counter: EUR
 * Base: BTC, Counter: USDT
 */
export class CurrencyPair implements CurrencyPairJSON {
  /**
   * Constructs a currency pair.
   *
   * @param base - Symbol of the base asset (i.e. TSLA)
   * @param counter - Symbol of the counter asset (i.e. EUR)
   */
  constructor(
    public readonly base: string,
    public readonly counter: string
  ) {}

  isEqual(other: CurrencyPair): boolean {
    return this.base === other.base && this.counter === other.counter;
  }

  asString(delimiter: string): string {
    return `${this.base}${delimiter}${this.counter}`;
  }

  static fromString(symbol: string, delimiter: string): CurrencyPair {
    const [base, counter] = symbol.split(delimiter);
    if (base && counter) {
      return new CurrencyPair(base, counter);
    }
    throw new Error(
      `Symbol "${symbol}" cannot be split with delimeter "${delimiter}".`
    );
  }
}
