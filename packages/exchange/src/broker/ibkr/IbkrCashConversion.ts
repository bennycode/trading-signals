import Big from 'big.js';
import {IBKR_LEDGER_BASE_KEY, type IbkrLedger, type IbkrLedgerEntry} from './api/schema/AccountSchema.js';

/**
 * Which way a ledger entry's `exchangerate` points.
 *
 * IBKR documents it as the rate to the account's base currency, but the ledger carries no unit
 * and reading it backwards inflates every balance by the square of the rate. The direction is
 * therefore taken from the data rather than from the documentation — see
 * {@link toExchangeRateDirection}.
 */
const RateDirection = {
  /** `cash ÷ rate` is the amount in the account currency. */
  FROM_BASE: 'from-base',
  /** `cash × rate` is the amount in the account currency. */
  TO_BASE: 'to-base',
} as const;
type RateDirection = (typeof RateDirection)[keyof typeof RateDirection];

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
 * the gap between a rate and its reciprocal for any currency pair this would be used on.
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
 * Which reading of `exchangerate` reproduces IBKR's own `BASE` total, or nothing when neither
 * does and the rates therefore cannot be trusted to size an order.
 *
 * Both readings are tried against the aggregate instead of one being assumed. A single-currency
 * ledger reconciles either way — its rate is 1 — which is harmless, since converting within one
 * currency is the identity whichever direction is picked.
 */
export function toExchangeRateDirection(ledger: IbkrLedger): RateDirection | undefined {
  const baseEntry = ledger[IBKR_LEDGER_BASE_KEY];
  const baseCash = baseEntry ? toSettledCash(baseEntry) : undefined;
  const entries = [...toCashEntries(ledger).values()];

  if (!baseCash || baseCash.eq(0) || entries.length === 0) {
    return undefined;
  }

  const multiplied = entries.reduce((sum, entry) => sum.plus(entry.cash.mul(entry.rate)), new Big(0));
  const divided = entries.reduce((sum, entry) => sum.plus(entry.cash.div(entry.rate)), new Big(0));
  const offBy = (total: Big) => total.minus(baseCash).abs().div(baseCash.abs());

  /*
   * Both readings land on the same total whenever every row with a rate other than 1 holds no
   * cash — which is exactly the shape this conversion exists for, a EUR balance and an empty USD
   * row. The totals agreeing does not make the answers agree: the per-currency figures still
   * differ by the square of the rate, EUR 1000 reading as either USD 1160 or USD 862. So an
   * aggregate that cannot tell the two apart is treated as no evidence rather than as a match.
   */
  if (multiplied.minus(divided).abs().div(baseCash.abs()).lte(RECONCILIATION_TOLERANCE)) {
    return undefined;
  }

  if (offBy(multiplied).lte(RECONCILIATION_TOLERANCE)) {
    return RateDirection.TO_BASE;
  }
  if (offBy(divided).lte(RECONCILIATION_TOLERANCE)) {
    return RateDirection.FROM_BASE;
  }

  return undefined;
}

/**
 * The account's whole settled cash expressed in `currency`, or nothing when it cannot be worked
 * out from the ledger alone.
 *
 * IBKR funds a USD trade out of a EUR balance by converting as it fills, so cash sitting in one
 * currency is spendable in another and a per-currency balance understates what an order may use.
 * A EUR-funded account buying a US stock reports no USD at all, which reads as "no buying power"
 * and stops a strategy placing anything.
 *
 * Nothing is returned rather than a guess whenever the ledger cannot support the conversion: no
 * row for the target currency, or rates that do not reconcile. The caller then keeps the
 * per-currency figure, which understates funds — an order that is smaller than it could be, in
 * place of one rejected for insufficient funds.
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

  const direction = toExchangeRateDirection(ledger);

  if (!direction) {
    return undefined;
  }

  const toBaseRate = (rate: Big) => (direction === RateDirection.TO_BASE ? rate : new Big(1).div(rate));
  const totalInBase = [...entries.values()].reduce(
    (sum, entry) => sum.plus(entry.cash.mul(toBaseRate(entry.rate))),
    new Big(0)
  );

  const available = totalInBase.div(toBaseRate(target.rate));

  // A margin account can run a negative cash balance; nothing is buyable with it.
  return available.gt(0) ? available : new Big(0);
}
