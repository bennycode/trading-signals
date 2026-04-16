import {z} from 'zod';

export const positiveNumberString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a positive number')
  .refine(val => parseFloat(val) > 0, 'Must be greater than 0');

/** Mutually exclusive buy sizing: set `quantity` (base) OR `spend` (counter), or neither for all available. */
export const BuyAmountSchema = z.union([
  z.object({quantity: positiveNumberString, spend: z.never().optional()}),
  z.object({spend: positiveNumberString, quantity: z.never().optional()}),
  z.object({quantity: z.never().optional(), spend: z.never().optional()}),
]);
