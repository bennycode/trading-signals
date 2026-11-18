import Big from 'big.js';
import {z} from 'zod';
import {getFilledBaseAmount, OrderSide} from '@typedtrader/exchange';
import type {Fill} from '@typedtrader/exchange';

const bigString = z.string().refine(value => {
  try {
    new Big(value);
    return true;
  } catch {
    return false;
  }
}, 'Must be a number');

/**
 * Everything the engine persists. Strategy authors never write state: a rule reads facts and
 * returns an order, so the only thing worth surviving a restart is what the engine itself tracks.
 */
export const LedgerSchema = z.object({
  /** Most favourable price seen since the position opened, `'0'` while flat. */
  bestPrice: bigString,
  /** Sum of `price × size` across every entry fill, which divided by `size` gives the entry price. */
  costBasis: bigString,
  /**
   * The last answer each `becomes()` condition gave, keyed by the rule's slot and position. It is
   * persisted because a crossing is a comparison against the previous candle, which a restart
   * would otherwise lose, and a missing entry means "not judged yet", which never fires.
   */
  crossings: z.record(z.string(), z.boolean()),
  entries: z.number().int().nonnegative(),
  exits: z.number().int().nonnegative(),
  /** `true` once a terminal exit has fully filled. The engine never opens again after that. */
  lastExitFinal: z.boolean(),
  lastExitPrice: bigString.nullable(),
  /**
   * A terminal exit that has been placed but not yet filled. Kept so the engine re-places the
   * same order on every candle until the position is gone, rather than relying on the rule that
   * produced it still matching, which a bounce in price would undo.
   */
  pendingFinalExit: z
    .object({because: z.string(), price: bigString.nullable(), quantity: bigString.nullable()})
    .nullable(),
  size: bigString,
});

export type Ledger = z.infer<typeof LedgerSchema>;

export const emptyLedger = (): Ledger => ({
  bestPrice: '0',
  costBasis: '0',
  crossings: {},
  entries: 0,
  exits: 0,
  lastExitFinal: false,
  lastExitPrice: null,
  pendingFinalExit: null,
  size: '0',
});

/**
 * What a position adopted from the balance starts out as, since no fill of ours described it.
 *
 * The anchor is the close rather than the high: the high happened before this strategy was
 * holding anything, and treating it as the best price seen would put a trailing stop's target
 * below a price the position never had — enough to sell it on the very candle it attached.
 */
export function adoptedPosition(candle: {close: Big}, size: Big): Partial<Ledger> {
  return {
    bestPrice: candle.close.toFixed(),
    costBasis: candle.close.mul(size).toFixed(),
    size: size.toFixed(),
  };
}

/** An entry fill, which averages into whatever the position already cost. */
export function afterEntryFill(
  ledger: Ledger,
  fill: {executedSize: Big; price: Big; receivedSize: Big}
): Partial<Ledger> {
  const size = new Big(ledger.size);
  const openingTrade = size.lte(0);

  return {
    bestPrice: openingTrade || fill.price.gt(new Big(ledger.bestPrice)) ? fill.price.toFixed() : ledger.bestPrice,
    costBasis: new Big(ledger.costBasis).plus(fill.price.mul(fill.executedSize)).toFixed(),
    entries: openingTrade ? ledger.entries + 1 : ledger.entries,
    size: size.plus(fill.receivedSize).toFixed(),
  };
}

/**
 * What a fill of ours makes of the ledger, whichever side it was on. The size received is not the
 * size executed: a fee taken in the asset leaves fewer units than were bought.
 */
export function afterFill(ledger: Ledger, fill: Fill, minimumSize: Big): Partial<Ledger> | null {
  const sizes = {executedSize: new Big(fill.size), price: new Big(fill.price), receivedSize: getFilledBaseAmount(fill)};

  return fill.side === OrderSide.BUY ? afterEntryFill(ledger, sizes) : afterExitFill(ledger, sizes, minimumSize);
}

/**
 * An exit fill. A partial exit keeps the entry price it was measured against, so the rest of the
 * position is still judged against what it cost rather than against what this exit got.
 */
export function afterExitFill(
  ledger: Ledger,
  fill: {price: Big; receivedSize: Big},
  minimumSize: Big
): Partial<Ledger> | null {
  const size = new Big(ledger.size);
  if (size.lte(0)) {
    return null;
  }

  /*
   * Selling everything is rounded down to the exchange's increment, which can leave a remainder
   * too small to ever sell again. Treating that dust as a position still held would hold a
   * terminal exit open and let the next candle's close, rather than this fill, stand as the price
   * the position left at.
   */
  const remaining = size.minus(fill.receivedSize);
  if (remaining.gte(minimumSize)) {
    return {
      costBasis: new Big(ledger.costBasis).div(size).mul(remaining).toFixed(),
      size: remaining.toFixed(),
    };
  }

  return closedPosition(ledger, fill.price, ledger.pendingFinalExit !== null);
}

/** A position that is no longer held, whether this engine sold it or something else did. */
export function closedPosition(ledger: Ledger, price: Big, final: boolean): Partial<Ledger> {
  return {
    bestPrice: '0',
    costBasis: '0',
    exits: ledger.exits + 1,
    lastExitFinal: final,
    lastExitPrice: price.toFixed(),
    pendingFinalExit: null,
    size: '0',
  };
}

/**
 * A tracked position brought in line with what is actually owned, or nothing when it already
 * matches. A holding can change without a fill of ours — sold by hand, topped up, rebalanced —
 * and a threshold measured per unit would then divide what the position cost by a size that is
 * not there: too small a size exits late, too large a one exits early.
 *
 * What is still held was bought at the entry price it was tracked with, so a reduction keeps it.
 * Units that appeared are priced at `price`, the same anchor a position adopted whole gets, since
 * no fill of ours says what was paid for them.
 */
export function resizedToOwned(ledger: Ledger, owned: Big, price: Big): Partial<Ledger> | null {
  const tracked = new Big(ledger.size);
  if (tracked.lte(0) || owned.eq(tracked)) {
    return null;
  }

  if (owned.lt(tracked)) {
    const entryPrice = new Big(ledger.costBasis).div(tracked);
    return {costBasis: entryPrice.mul(owned).toFixed(), size: owned.toFixed()};
  }

  const added = owned.minus(tracked);
  return {costBasis: new Big(ledger.costBasis).plus(added.mul(price)).toFixed(), size: owned.toFixed()};
}
