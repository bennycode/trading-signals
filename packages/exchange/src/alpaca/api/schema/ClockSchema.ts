import {z} from 'zod';

export const ClockSchema = z.looseObject({
  is_open: z.boolean(),
  next_close: z.string(),
  next_open: z.string(),
  timestamp: z.string(),
});
