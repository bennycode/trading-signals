import {z} from 'zod';
import {OrderSchema} from './OrderSchema.js';

/** @see https://docs.alpaca.markets/docs/websocket-streaming */
export const TradeUpdateEvent = {
  ACCEPTED: 'accepted',
  CALCULATED: 'calculated',
  CANCELED: 'canceled',
  DONE_FOR_DAY: 'done_for_day',
  EXPIRED: 'expired',
  FILL: 'fill',
  NEW: 'new',
  ORDER_CANCEL_REJECTED: 'order_cancel_rejected',
  ORDER_REPLACE_REJECTED: 'order_replace_rejected',
  PARTIAL_FILL: 'partial_fill',
  PENDING_CANCEL: 'pending_cancel',
  PENDING_NEW: 'pending_new',
  PENDING_REPLACE: 'pending_replace',
  REJECTED: 'rejected',
  REPLACED: 'replaced',
  STOPPED: 'stopped',
  SUSPENDED: 'suspended',
} as const;

/**
 * Schema for messages received on the `trade_updates` stream.
 * The `order` object matches the REST API OrderSchema.
 * Fill/partial_fill events include additional fields: `price`, `qty`, `position_qty`, and `timestamp`.
 *
 * @see https://docs.alpaca.markets/docs/websocket-streaming
 */
export const TradeUpdateMessageSchema = z.looseObject({
  event: z.string(),
  order: OrderSchema,
  /** Per-share fill price (present on fill/partial_fill events) */
  price: z.string().optional(),
  /** Number of shares filled in this event (present on fill/partial_fill events) */
  qty: z.string().optional(),
  /** Total position size after this event (present on fill/partial_fill events) */
  position_qty: z.string().optional(),
  /** Timestamp of the fill event */
  timestamp: z.string().optional(),
});

export type TradeUpdateMessage = z.infer<typeof TradeUpdateMessageSchema>;
