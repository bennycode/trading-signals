import {z} from 'zod';

/**
 * The cash ledger: deposits, withdrawals, fees and interest. It is the only Trading212 endpoint
 * that names a currency, which makes it the only way to see a non-primary wallet at all — the
 * account endpoints report a single aggregate with no currency field.
 *
 * It does **not** contain trades, so wallet balances cannot be rebuilt from it. Buying a USD
 * instrument spends the USD wallet without leaving a transaction here, and a replay would drift
 * further from reality with every order.
 *
 * @see https://t212public-api-docs.redoc.ly/#operation/transactions
 */
export const TransactionSchema = z.looseObject({
  /** Signed: a withdrawal, fee or conversion out of a wallet is negative. */
  amount: z.number(),
  /** The wallet this entry moved, which need not be the account's primary currency. */
  currency: z.string(),
  /** ISO 8601, UTC. A currency conversion shares one timestamp across its three entries. */
  dateTime: z.string(),
  reference: z.string().nullish(),
  /** Observed: `DEPOSIT`, `WITHDRAW`, `FEE`, `INTEREST_ON_FREE_CASH`. Never a trade. */
  type: z.string(),
});

export const TransactionPageSchema = z.looseObject({
  items: z.array(TransactionSchema),
  nextPagePath: z.string().nullish(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionPage = z.infer<typeof TransactionPageSchema>;
