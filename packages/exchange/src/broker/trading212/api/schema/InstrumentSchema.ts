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
  /** Whether the instrument trades on Trading212's 24/5 venue outside its exchange's hours. */
  extendedHours: z.boolean().nullish(),
  /** International Securities Identification Number, e.g. "US0378331005" */
  isin: z.string().nullish(),
  maxOpenQuantity: z.number().nullish(),
  minTradeQuantity: z.number().nullish(),
  name: z.string(),
  shortname: z.string().nullish(),
  /** The vendor ticker, e.g. "AAPL_US_EQ" */
  ticker: z.string(),
  type: Trading212InstrumentTypeSchema,
  workingScheduleId: z.number().nullish(),
});

export type Instrument = z.infer<typeof InstrumentSchema>;
