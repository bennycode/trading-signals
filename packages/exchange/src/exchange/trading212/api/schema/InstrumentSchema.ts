import {z} from 'zod';

export const Trading212InstrumentTypeSchema = z.enum([
  'CORPACT',
  'CRYPTO',
  'CRYPTOCURRENCY',
  'CVR',
  'ETF',
  'FOREX',
  'FUTURES',
  'INDEX',
  'STOCK',
  'WARRANT',
]);

export const InstrumentSchema = z.looseObject({
  addedOn: z.string(),
  currencyCode: z.string(),
  /** International Securities Identification Number, e.g. "US0378331005" */
  isin: z.string(),
  maxOpenQuantity: z.number(),
  minTradeQuantity: z.number(),
  name: z.string(),
  shortname: z.string().optional(),
  /** The vendor ticker, e.g. "AAPL_US_EQ" */
  ticker: z.string(),
  type: Trading212InstrumentTypeSchema,
  workingScheduleId: z.number(),
});

export type Instrument = z.infer<typeof InstrumentSchema>;
