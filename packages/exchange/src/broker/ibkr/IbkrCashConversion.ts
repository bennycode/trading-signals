import Big from 'big.js';
import {IBKR_LEDGER_BASE_KEY, type IbkrLedger, type IbkrLedgerEntry} from './api/schema/AccountSchema.js';

/** A ledger entry reduced to the two numbers a conversion needs. */
interface CashEntry {
  cash: Big;
  rate: Big;
}

/**
 * Within 1% of the aggregate is treated as agreement.
 *
 * The `BASE` row is IBKR's own total and is struck at the same instant as the rows it sums, so a
 * correct reading reconciles to the cent. The tolerance only absorbs rounding, and is far below
 * the gap a misread rate would open.
 */
const RECONCILIATION_TOLERANCE = 0.01;

function toBig(value: number | null | undefined): Big | undefined {
  return value === null || value === undefined ? undefined : new Big(value);
}

/** Settled cash, falling back to the total when IBKR reports no settled figure. */
function toSettledCash(entry: IbkrLedgerEntry): Big | undefined {
  return toBig(entry.settledcash) ?? toBig(entry.cashbalance);
}

/** The real currency rows, i.e. everything but IBKR's `BASE` aggregate. */
function toCashEntries(ledger: IbkrLedger): Map<string, CashEntry> {
  const entries = new Map<string, CashEntry>();

  for (const [key, entry] of Object.entries(ledger)) {
    if (key === IBKR_LEDGER_BASE_KEY) {
      continue;
    }

    const cash = toSettledCash(entry);
    const rate = toBig(entry.exchangerate);

    if (cash && rate?.gt(0)) {
      entries.set((entry.currency ?? key).toUpperCase(), {cash, rate});
    }
  }

  return entries;
}

/**
 * The account's whole settled cash expressed in `currency`, or nothing when the ledger does not
 * add up.
 *
 * IBKR funds a USD trade out of a EUR balance by converting as it fills, so cash sitting in one
 * currency is spendable in another and a per-currency balance understates what an order may use.
 * A EUR-funded account buying a US stock reports no USD at all, which reads as "no buying power"
 * and stops a strategy placing anything.
 *
 * `exchangerate` multiplies a row into the account's base currency: a live ledger on a EUR account
 * carried 0.9098 for USD while EUR/USD traded at 1.0993. Reading it backwards would inflate every
 * balance by the square of the rate, so the figure is only used once IBKR's own `BASE` total
 * confirms it, and nothing is returned when it does not.
 *
 * The caller then keeps the per-currency figure, which understates funds — an order smaller than
 * it could be, in place of one rejected for insufficient funds.
 */
export function toAvailableCash(ledger: IbkrLedger, currency: string): Big | undefined {
  const entries = toCashEntries(ledger);
  const target = entries.get(currency.toUpperCase());

  if (!target) {
    return undefined;
  }

  if (entries.size === 1) {
    return target.cash;
  }

  const baseEntry = ledger[IBKR_LEDGER_BASE_KEY];
  const baseCash = baseEntry ? toSettledCash(baseEntry) : undefined;

  if (!baseCash || baseCash.eq(0)) {
    return undefined;
  }

  const totalInBase = [...entries.values()].reduce((sum, entry) => sum.plus(entry.cash.mul(entry.rate)), new Big(0));

  if (totalInBase.minus(baseCash).abs().div(baseCash.abs()).gt(RECONCILIATION_TOLERANCE)) {
    return undefined;
  }

  const available = totalInBase.div(target.rate);

  // A margin account can run a negative cash balance; nothing is buyable with it.
  return available.gt(0) ? available : new Big(0);
}
