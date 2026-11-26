import {z} from 'zod';

/**
 * An execution. IBKR reports `size` unsigned and puts the direction in `side` (`B` / `S`), and
 * sends most numbers as strings.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/order-management
 */
export const IbkrTradeSchema = z.looseObject({
  account: z.string().nullish(),
  commission: z.union([z.string(), z.number()]).nullish(),
  conid: z.union([z.string(), z.number()]).nullish(),
  execution_id: z.string().nullish(),
  /** Executed value of this trade, before commission. */
  net_amount: z.number().nullish(),
  /** Absent on trades placed outside the API, so it cannot be relied on to match an order. */
  order_id: z.union([z.string(), z.number()]).nullish(),
  order_ref: z.string().nullish(),
  price: z.union([z.string(), z.number()]).nullish(),
  /**
   * `STK`, `OPT`, `CASH`, … The trades feed carries more than the account's own orders: funding a
   * USD trade from a EUR balance adds `CASH` executions on IDEALPRO that nobody placed, so this
   * is what separates a real fill from a currency conversion.
   */
  sec_type: z.string().nullish(),
  side: z.string().nullish(),
  size: z.union([z.string(), z.number()]).nullish(),
  symbol: z.string().nullish(),
  /** A display string in the account's timezone; prefer the epoch-millisecond `trade_time_r`. */
  trade_time: z.string().nullish(),
  trade_time_r: z.number().nullish(),
});

export const IbkrTradesResponseSchema = z.array(IbkrTradeSchema);

/** The `sec_type` IBKR gives a currency conversion, as opposed to `STK` and friends. */
export const IBKR_FX_SEC_TYPE = 'CASH';

export type IbkrTrade = z.infer<typeof IbkrTradeSchema>;
