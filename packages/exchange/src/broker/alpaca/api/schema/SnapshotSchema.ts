import {z} from 'zod';
import {BarSchema} from './BarSchema.js';

export const TradeSchema = z.looseObject({
  /** Trade price */
  p: z.number(),
  /** Trade size */
  s: z.number(),
  /** Timestamp in RFC 3339 format */
  t: z.string(),
});

export type Trade = z.infer<typeof TradeSchema>;

export const SnapshotSchema = z.looseObject({
  dailyBar: BarSchema.optional(),
  latestTrade: TradeSchema.optional(),
  minuteBar: BarSchema.optional(),
  prevDailyBar: BarSchema.optional(),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

export const SnapshotsResponseSchema = z.record(z.string(), SnapshotSchema);
