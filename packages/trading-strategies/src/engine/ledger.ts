import Big from 'big.js';
import {z} from 'zod';

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

/** What a position adopted from the balance starts out as, since no fill of ours described it. */
export function adoptedPosition(candle: {close: Big; high: Big}, size: Big): Partial<Ledger> {
  return {
    bestPrice: candle.high.toFixed(),
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
 * An exit fill. A partial exit keeps the entry price it was measured against, so the rest of the
 * position is still judged against what it cost rather than against what this exit got.
 */
export function afterExitFill(ledger: Ledger, fill: {price: Big; receivedSize: Big}): Partial<Ledger> | null {
  const size = new Big(ledger.size);
  if (size.lte(0)) {
    return null;
  }

  const remaining = size.minus(fill.receivedSize);
  if (remaining.gt(0)) {
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
