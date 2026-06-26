import {z} from 'zod';

/** @see https://site.financialmodelingprep.com/developer/docs/stable#ratings-snapshot */
export const FmpRatingsSnapshotSchema = z.looseObject({
  rating: z.string(),
  symbol: z.string(),
});

export type FmpRatingsSnapshot = z.infer<typeof FmpRatingsSnapshotSchema>;
