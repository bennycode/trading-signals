import {z} from 'zod';
import {emptyLedger, LedgerSchema, type Ledger} from './ledger.js';

const numberString = z.string().regex(/^-?\d+(\.\d+)?$/);

/**
 * What the strategy classes this engine replaces wrote. Every part is optional because each class
 * persisted its own subset: the kill switches came from the shared base, `bought` from BuyOnce,
 * and the trailing stop kept its own peak and exit.
 */
const LegacyStateSchema = z.looseObject({
  bought: z.boolean().optional(),
  exited: z.boolean().optional(),
  peakPrice: numberString.optional(),
  protected: z
    .looseObject({
      killed: z.boolean(),
      killedLimitPrice: numberString.nullable().optional(),
      killedReason: z.string().nullable().optional(),
      totalCostBasis: numberString.optional(),
      totalPositionSize: numberString.optional(),
    })
    .optional(),
});

/**
 * The ledger a persisted snapshot comes back as: its own, one translated from the strategy class
 * this engine replaces, or an empty one. `wasReset` is for the last case alone, and only when
 * there was something there to lose, because an empty ledger re-adopts the position from the
 * balance on the next candle but cannot recover a ratcheted trail or what the position cost.
 */
export function restoredLedger(persisted: Record<string, unknown>): {ledger: Ledger; wasReset: boolean} {
  const parsed = LedgerSchema.safeParse(persisted);
  if (parsed.success) {
    return {ledger: parsed.data, wasReset: false};
  }

  const migrated = fromLegacyState(persisted);
  if (migrated) {
    return {ledger: migrated, wasReset: false};
  }

  return {ledger: emptyLedger(), wasReset: Object.keys(persisted).length > 0};
}

/**
 * Reads a snapshot one of the replaced strategy classes wrote, so an upgrade keeps the decisions
 * that cannot be taken again. A tripped kill switch is the important one: re-armed from scratch it
 * would measure its threshold from whatever the position is worth now, and an entry rule could buy
 * back into a position the user's stop had already sold.
 *
 * Answers `null` for a snapshot that carries none of those decisions.
 */
export function fromLegacyState(persisted: Record<string, unknown>): Ledger | null {
  const parsed = LegacyStateSchema.safeParse(persisted);
  if (!parsed.success) {
    return null;
  }

  const {bought, exited, peakPrice, protected: guards} = parsed.data;
  if (bought === undefined && exited === undefined && peakPrice === undefined && guards === undefined) {
    return null;
  }

  const size = guards?.totalPositionSize ?? '0';
  const holding = Number.parseFloat(size) > 0;
  const killed = guards?.killed === true;

  return {
    ...emptyLedger(),
    bestPrice: peakPrice ?? '0',
    costBasis: guards?.totalCostBasis ?? '0',
    /*
     * A position bought by BuyOnce counts as its one entry, so the strategy stays done with
     * buying even if that position is sold while it is not running.
     */
    entries: bought === true ? 1 : 0,
    exits: exited === true ? 1 : 0,
    // Terminal either way: the switch fired, and what is left of it is a sale to finish or a sale that is done.
    lastExitFinal: (killed || exited === true) && !holding,
    pendingFinalExit:
      killed && holding
        ? {
            because: guards?.killedReason ?? 'Kill switch fired before this strategy was restarted',
            price: guards?.killedLimitPrice ?? null,
            quantity: null,
          }
        : null,
    size,
  };
}
