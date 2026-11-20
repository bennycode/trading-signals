import {z} from 'zod';

/** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/accounts */
export const IbkrAccountsSchema = z.looseObject({
  accounts: z.array(z.string()),
  selectedAccount: z.string().optional(),
});

/** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/portfolio */
export const IbkrPortfolioAccountSchema = z.looseObject({
  accountId: z.string().optional(),
  currency: z.string().nullish(),
  id: z.string(),
  tradingType: z.string().nullish(),
  type: z.string().nullish(),
});

/**
 * One currency's cash position. IBKR reports `cashbalance` including proceeds that have not
 * settled yet, while `settledcash` excludes them — the distinction matters on a cash account,
 * where unsettled proceeds cannot fund a new purchase.
 */
export const IbkrLedgerEntrySchema = z.looseObject({
  cashbalance: z.number().nullish(),
  currency: z.string().nullish(),
  exchangerate: z.number().nullish(),
  netliquidationvalue: z.number().nullish(),
  realizedpnl: z.number().nullish(),
  settledcash: z.number().nullish(),
  stockmarketvalue: z.number().nullish(),
  unrealizedpnl: z.number().nullish(),
});

/**
 * Keyed by currency code. IBKR adds a `BASE` key holding the account-currency total across every
 * other entry, so it is an aggregate rather than a real currency — see {@link IBKR_LEDGER_BASE_KEY}.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/portfolio
 */
export const IbkrLedgerSchema = z.record(z.string(), IbkrLedgerEntrySchema);

/**
 * The aggregate pseudo-currency in a ledger response. Counting it alongside the real entries
 * would double every balance.
 */
export const IBKR_LEDGER_BASE_KEY = 'BASE';

/** @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/portfolio */
export const IbkrPositionSchema = z.looseObject({
  avgCost: z.number().nullish(),
  avgPrice: z.number().nullish(),
  conid: z.number(),
  contractDesc: z.string().nullish(),
  currency: z.string().nullish(),
  mktPrice: z.number().nullish(),
  mktValue: z.number().nullish(),
  position: z.number(),
  ticker: z.string().nullish(),
});

export type IbkrAccounts = z.infer<typeof IbkrAccountsSchema>;
export type IbkrLedger = z.infer<typeof IbkrLedgerSchema>;
export type IbkrLedgerEntry = z.infer<typeof IbkrLedgerEntrySchema>;
export type IbkrPortfolioAccount = z.infer<typeof IbkrPortfolioAccountSchema>;
export type IbkrPosition = z.infer<typeof IbkrPositionSchema>;
