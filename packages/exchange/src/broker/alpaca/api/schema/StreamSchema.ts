import {z} from 'zod';

/** @see https://docs.alpaca.markets/docs/real-time-stock-pricing-data#bars */
export const MinuteBarMessageSchema = z.looseObject({
  /** Closing price */
  c: z.number(),
  /** High price */
  h: z.number(),
  /** Low price */
  l: z.number(),
  /** Trade count in the bar */
  n: z.number(),
  /** Open price */
  o: z.number(),
  /** Symbol */
  S: z.string(),
  /** Message type */
  T: z.literal('b'),
  /** Timestamp in RFC 3339 format with nanosecond precision */
  t: z.string(),
  /** Bar volume */
  v: z.number(),
  /** Volume weighted average price */
  vw: z.number(),
});

export const ConnectedMessageSchema = z.looseObject({
  msg: z.literal('connected'),
  T: z.literal('success'),
});

export const AuthenticatedMessageSchema = z.looseObject({
  msg: z.literal('authenticated'),
  T: z.literal('success'),
});

export const SubscriptionMessageSchema = z.looseObject({
  T: z.literal('subscription'),
  bars: z.array(z.string()),
});

export const StreamMessageSchema = z.union([
  ConnectedMessageSchema,
  AuthenticatedMessageSchema,
  SubscriptionMessageSchema,
  MinuteBarMessageSchema,
]);

export type MinuteBarMessage = z.infer<typeof MinuteBarMessageSchema>;
export type StreamMessage = z.infer<typeof StreamMessageSchema>;
