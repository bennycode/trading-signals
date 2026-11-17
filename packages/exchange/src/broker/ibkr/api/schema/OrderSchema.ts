import {z} from 'zod';

export const IbkrOrderSide = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;
export type IbkrOrderSide = (typeof IbkrOrderSide)[keyof typeof IbkrOrderSide];

export const IbkrOrderType = {
  LIMIT: 'LMT',
  MARKET: 'MKT',
} as const;
export type IbkrOrderType = (typeof IbkrOrderType)[keyof typeof IbkrOrderType];

/**
 * IBKR's time-in-force codes. The two overnight values also pick the venue: setting one routes the
 * order to IBKR Overnight (liquidity via Blue Ocean), which is a destination of its own rather than
 * the extended-hours flag `outsideRTH` — so an overnight order is not a day order with a longer
 * window. The session runs 20:00–03:50 ET, Sunday through Friday, which makes IBKR 24/5 and not
 * 24/7, and it accepts limit orders only.
 *
 * A contract's `tifTypes` says which of these it allows, e.g. `OND/o,a,LIMIT` for Ford.
 *
 * @see https://www.interactivebrokers.com/en/trading/orders/overnight-trading-orders.php
 */
export const IbkrTimeInForce = {
  DAY: 'DAY',
  GTC: 'GTC',
  /** Overnight session only; an unfilled order expires at 03:50 ET instead of resting. */
  OVERNIGHT: 'OVT',
  /** Overnight session, then on through the regular session that follows. */
  OVERNIGHT_AND_DAY: 'OND',
} as const;

/**
 * Statuses that mean the order is still working, so `getOpenOrders` can tell them from the
 * terminal ones IBKR keeps returning in the same list.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/order-management
 */
export const IBKR_LIVE_ORDER_STATUSES = new Set(['PendingSubmit', 'PreSubmitted', 'Submitted', 'PendingCancel']);

export const IbkrLiveOrderSchema = z.looseObject({
  account: z.string().nullish(),
  avgPrice: z.union([z.string(), z.number()]).nullish(),
  conid: z.union([z.string(), z.number()]).nullish(),
  filledQuantity: z.union([z.string(), z.number()]).nullish(),
  lastExecutionTime_r: z.union([z.string(), z.number()]).nullish(),
  orderId: z.union([z.string(), z.number()]),
  orderType: z.string().nullish(),
  price: z.union([z.string(), z.number()]).nullish(),
  remainingQuantity: z.union([z.string(), z.number()]).nullish(),
  side: z.string().nullish(),
  status: z.string().nullish(),
  ticker: z.string().nullish(),
  totalSize: z.union([z.string(), z.number()]).nullish(),
});

export const IbkrLiveOrdersResponseSchema = z.looseObject({
  orders: z.array(IbkrLiveOrderSchema).nullish(),
  /**
   * `false` means IBKR is still assembling the order list and the caller should ask again, rather
   * than conclude there are no open orders.
   */
  snapshot: z.boolean().nullish(),
});

/**
 * One leg of an order submission. `cOID` is a caller-generated id: when a POST fails without a
 * response, the same id can be queried (and a resubmission is deduplicated server-side) instead
 * of risking a double fill.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/order-management
 */
export const IbkrOrderRequestSchema = z.object({
  /** Notional ("buy $200 worth") instead of a share count. */
  cashQty: z.number().optional(),
  cOID: z.string().optional(),
  conid: z.number(),
  orderType: z.string(),
  /**
   * Permits execution in the pre-market and after-hours sessions. Note that IBKR restricts those
   * to limit-family order types (a contract's `orderTypesOutside` lists them), and that this does
   * not reach the overnight session — see {@link IbkrTimeInForce}.
   */
  outsideRTH: z.boolean().optional(),
  price: z.number().optional(),
  quantity: z.number().optional(),
  side: z.string(),
  tif: z.string(),
});

export const IbkrOrdersSubmissionRequestSchema = z.object({
  orders: z.array(IbkrOrderRequestSchema),
});

export const IbkrOrderSubmitSuccessSchema = z.looseObject({
  order_id: z.string(),
  order_status: z.string().nullish(),
});

/**
 * Not an error: IBKR asks the caller to confirm a warning (market hours, size, and so on) before
 * the order is accepted. Answering it at `/iserver/reply/{replyId}` continues the submission.
 */
export const IbkrOrderReplyMessageSchema = z.looseObject({
  id: z.string(),
  isSuppressed: z.boolean().nullish(),
  message: z.array(z.string()).nullish(),
});

export const IbkrOrderSubmitErrorSchema = z.looseObject({
  error: z.string(),
});

/**
 * A submission answers with any of these shapes under HTTP 200, so the caller discriminates on
 * the fields rather than on the status code.
 */
export const IbkrOrderSubmitResponseSchema = z.array(
  z.union([IbkrOrderSubmitSuccessSchema, IbkrOrderReplyMessageSchema, IbkrOrderSubmitErrorSchema])
);

export const IbkrOrderReplyResponseSchema = z.array(
  z.union([IbkrOrderSubmitSuccessSchema, IbkrOrderReplyMessageSchema, IbkrOrderSubmitErrorSchema])
);

/**
 * What a `whatif` preview reports. `commission` is IBKR's own projection for this exact order,
 * which beats modelling the tiered per-share schedule locally.
 */
export const IbkrOrderPreviewSchema = z.looseObject({
  amount: z
    .looseObject({
      amount: z.string().nullish(),
      commission: z.string().nullish(),
      total: z.string().nullish(),
    })
    .nullish(),
  error: z.string().nullish(),
});

export function isIbkrOrderSubmitSuccess(value: unknown): value is z.infer<typeof IbkrOrderSubmitSuccessSchema> {
  return typeof value === 'object' && value !== null && 'order_id' in value;
}

export function isIbkrOrderReplyMessage(value: unknown): value is z.infer<typeof IbkrOrderReplyMessageSchema> {
  return typeof value === 'object' && value !== null && 'id' in value && 'message' in value;
}

export function isIbkrOrderSubmitError(value: unknown): value is z.infer<typeof IbkrOrderSubmitErrorSchema> {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export type IbkrLiveOrder = z.infer<typeof IbkrLiveOrderSchema>;
export type IbkrOrderPreview = z.infer<typeof IbkrOrderPreviewSchema>;
export type IbkrOrderRequest = z.infer<typeof IbkrOrderRequestSchema>;
export type IbkrOrderSubmitResponse = z.infer<typeof IbkrOrderSubmitResponseSchema>;
