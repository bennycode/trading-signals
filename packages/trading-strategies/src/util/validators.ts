import {z} from 'zod';

export const positiveNumberString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a positive number')
  .refine(val => parseFloat(val) > 0, 'Must be greater than 0');
