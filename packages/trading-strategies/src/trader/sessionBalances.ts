import Big from 'big.js';
import type {Balance, TradingPair} from '@typedtrader/exchange';
import type {TradingSessionState} from './TradingSessionTypes.js';

export interface SessionBalances {
  /** Base currency that can be spent right now. */
  base: Big;
  /**
   * Base currency the broker is holding against an unfilled order of ours. A strategy owns it
   * either way, so a position is `base` plus this: reading the available balance alone makes a
   * strategy's own resting sell look like a position someone else has closed.
   *
   * Brokers differ on where they put it. One that reserves moves the quantity out of `available`
   * and into `hold`; Alpaca reports the whole position as available and holds nothing. Both are
   * read correctly by adding the two together, which is also why this is taken from the broker
   * rather than from the orders we remember placing: an order that left the book without a fill
   * of ours stops being counted the moment the broker stops counting it.
   */
  baseOnHold: Big;
  /** Counter currency that can be spent right now. */
  counter: Big;
}

/**
 * Reads one balance snapshot for a pair, so that what is available and what is held always
 * describe the same moment.
 */
export function sessionBalances(balances: readonly Balance[], pair: TradingPair): SessionBalances {
  const of = (currency: string) => balances.find(balance => balance.currency === currency);
  const base = of(pair.base);
  const counter = of(pair.counter);

  return {
    base: new Big(base?.available ?? 0),
    baseOnHold: new Big(base?.hold ?? 0),
    counter: new Big(counter?.available ?? 0),
  };
}

/**
 * The position as a strategy owns it, which is not the same as what it can trade: an unfilled
 * limit sell of its own holds the balance it is offering. Counting only what is available would
 * read that resting order as a position that had disappeared.
 */
export function ownedBase(state: TradingSessionState): Big {
  return state.baseBalance.plus(state.baseBalanceOnHold);
}

/** Dust below the exchange's minimum order size is not a position, whoever is holding it. */
export function holdsPosition(state: TradingSessionState): boolean {
  return ownedBase(state).gte(new Big(state.tradingRules.base_min_size));
}
