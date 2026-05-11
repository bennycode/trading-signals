import {z} from 'zod';
import {ProtectedStrategySchema} from '../strategy-protected/ProtectedStrategy.js';

export const MultiIndicatorConfluenceSchema = ProtectedStrategySchema.extend({
  /** EMA short period for trend detection. */
  emaShortPeriod: z.number().int().positive(),
  /** EMA long period for trend detection. */
  emaLongPeriod: z.number().int().positive(),
  /** MACD short EMA period. */
  macdShortPeriod: z.number().int().positive(),
  /** MACD long EMA period. */
  macdLongPeriod: z.number().int().positive(),
  /** MACD signal EMA period. */
  macdSignalPeriod: z.number().int().positive(),
  /** Bollinger Bands period. */
  bollingerPeriod: z.number().int().positive(),
  /** Bollinger Bands standard deviation multiplier. */
  bollingerDeviationMultiplier: z.number().positive(),
  /** RSI period. */
  rsiPeriod: z.number().int().positive(),
  /** RSI overbought threshold (veto BUY above this). */
  rsiOverbought: z.number().positive().max(100),
  /** RSI oversold threshold (veto SELL below this). */
  rsiOversold: z.number().positive().max(100),
})
  .refine(data => data.emaShortPeriod < data.emaLongPeriod, {
    message: 'emaShortPeriod must be less than emaLongPeriod',
    path: ['emaShortPeriod'],
  })
  .refine(data => data.macdShortPeriod < data.macdLongPeriod, {
    message: 'macdShortPeriod must be less than macdLongPeriod',
    path: ['macdShortPeriod'],
  })
  .refine(data => data.rsiOversold < data.rsiOverbought, {
    message: 'rsiOversold must be less than rsiOverbought',
    path: ['rsiOversold'],
  });

export type MultiIndicatorConfluenceConfig = z.input<typeof MultiIndicatorConfluenceSchema>;
