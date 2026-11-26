import {z} from 'zod';

/**
 * IBKR addresses instruments by a numeric contract id rather than by ticker, so every call the
 * broker makes starts with one of these lookups.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/contracts
 */
export const IbkrSecdefSearchItemSchema = z.looseObject({
  companyHeader: z.string().nullish(),
  companyName: z.string().nullish(),
  /** A string here, while every other endpoint returns the same id as a number. */
  conid: z.union([z.string(), z.number()]),
  /** The listing exchange, e.g. `NASDAQ`. */
  description: z.string().nullish(),
  /**
   * IBKR's OpenAPI spec declares this a boolean, but the live endpoint answers with a string
   * (`"false"`). Accepting both keeps a contract lookup from failing validation on a field
   * nothing here reads.
   */
  restricted: z.union([z.boolean(), z.string()]).nullish(),
  sections: z
    .array(
      z.looseObject({
        exchange: z.string().nullish(),
        secType: z.string().nullish(),
      })
    )
    .nullish(),
  symbol: z.string().nullish(),
});

export const IbkrSecdefSearchResponseSchema = z.array(IbkrSecdefSearchItemSchema);

/**
 * The price tick applicable above `lowerEdge`. IBKR varies the tick by price band, so a single
 * instrument carries several of these.
 */
export const IbkrIncrementRuleSchema = z.looseObject({
  increment: z.number().nullish(),
  lowerEdge: z.number().nullish(),
});

export const IbkrContractRulesSchema = z.looseObject({
  /** Decimal places allowed on a fractional quantity, e.g. `4` for a 0.0001 share step. */
  fraqInt: z.number().nullish(),
  /** Order types that may be placed for a fractional quantity. Empty when the contract is whole-share only. */
  fraqTypes: z.array(z.string()).nullish(),
  /** Price tick at the current price band. */
  increment: z.number().nullish(),
  incrementRules: z.array(IbkrIncrementRuleSchema).nullish(),
  orderTypes: z.array(z.string()).nullish(),
  /**
   * The step the order ticket's quantity spinner moves by, which IBKR reports as 40 for AAPL.
   * It is a UI affordance, not a tradable minimum, so it must not be mapped onto
   * `TradingRules.base_increment` — see {@link IbkrBroker.getTradingRules}.
   */
  sizeIncrement: z.number().nullish(),
});

export const IbkrContractInfoSchema = z.looseObject({
  category: z.string().nullish(),
  company_name: z.string().nullish(),
  companyName: z.string().nullish(),
  con_id: z.number().nullish(),
  currency: z.string().nullish(),
  exchange: z.string().nullish(),
  instrument_type: z.string().nullish(),
  rules: IbkrContractRulesSchema.nullish(),
  symbol: z.string().nullish(),
});

export type IbkrContractInfo = z.infer<typeof IbkrContractInfoSchema>;
export type IbkrContractRules = z.infer<typeof IbkrContractRulesSchema>;
export type IbkrSecdefSearchItem = z.infer<typeof IbkrSecdefSearchItemSchema>;
