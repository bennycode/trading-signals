import {z} from 'zod';
import {BollingerBands, EMA, MACD, RSI} from 'trading-signals';
import {defineStrategy, every} from '../engine/index.js';
import {MarketType} from '../strategy/MarketType.js';

const CANDLE = '1m';

export const MultiIndicatorConfluenceSchema = z
  .object({
    /** Bollinger Bands standard deviation multiplier. */
    bollingerDeviationMultiplier: z.number().positive(),
    /** Bollinger Bands period. */
    bollingerPeriod: z.number().int().positive(),
    /** EMA long period for trend detection. */
    emaLongPeriod: z.number().int().positive(),
    /** EMA short period for trend detection. */
    emaShortPeriod: z.number().int().positive(),
    /** MACD long EMA period. */
    macdLongPeriod: z.number().int().positive(),
    /** MACD short EMA period. */
    macdShortPeriod: z.number().int().positive(),
    /** MACD signal EMA period. */
    macdSignalPeriod: z.number().int().positive(),
    /** RSI overbought threshold, above which a buy is vetoed. */
    rsiOverbought: z.number().positive().max(100),
    /** RSI oversold threshold, below which a sell is vetoed. */
    rsiOversold: z.number().positive().max(100),
    /** RSI period. */
    rsiPeriod: z.number().int().positive(),
  })
  .refine(config => config.emaShortPeriod < config.emaLongPeriod, {
    message: 'emaShortPeriod must be less than emaLongPeriod',
    path: ['emaShortPeriod'],
  })
  .refine(config => config.macdShortPeriod < config.macdLongPeriod, {
    message: 'macdShortPeriod must be less than macdLongPeriod',
    path: ['macdShortPeriod'],
  })
  .refine(config => config.rsiOversold < config.rsiOverbought, {
    message: 'rsiOversold must be less than rsiOverbought',
    path: ['rsiOversold'],
  });

export type MultiIndicatorConfluenceConfig = z.input<typeof MultiIndicatorConfluenceSchema>;

/**
 * Trades only where four independent readings agree: the EMA pair for trend, the MACD histogram
 * for momentum, a Bollinger Band for the entry price, and RSI as a veto against buying what is
 * already overbought or selling what is already oversold.
 */
export const MultiIndicatorConfluence = defineStrategy(MultiIndicatorConfluenceSchema)({
  indicators: {
    bands: every(CANDLE, config => new BollingerBands(config.bollingerPeriod, config.bollingerDeviationMultiplier)),
    emaLong: every(CANDLE, config => new EMA(config.emaLongPeriod)),
    emaShort: every(CANDLE, config => new EMA(config.emaShortPeriod)),
    macd: every(
      CANDLE,
      config =>
        new MACD(new EMA(config.macdShortPeriod), new EMA(config.macdLongPeriod), new EMA(config.macdSignalPeriod))
    ),
    rsi: every(CANDLE, config => new RSI(config.rsiPeriod)),
  },
  long: {
    close: {
      because: ({bands, close, config, emaLong, emaShort, macd, rsi}) =>
        [
          `EMA trend bearish (short ${emaShort.toFixed(2)} < long ${emaLong.toFixed(2)})`,
          `MACD momentum bearish (histogram ${macd.histogram.toFixed(4)})`,
          `Price ${close.toFixed(2)} at/above upper Bollinger Band ${bands.upper.toFixed(2)}`,
          `RSI ${rsi.toFixed(2)} not oversold (> ${config.rsiOversold})`,
        ].join('; '),
      quantity: 'all',
      when: ({bands, close, config, emaLong, emaShort, macd, rsi}) =>
        emaShort < emaLong && macd.histogram < 0 && close >= bands.upper && rsi > config.rsiOversold,
    },
    open: {
      because: ({bands, close, config, emaLong, emaShort, macd, rsi}) =>
        [
          `EMA trend bullish (short ${emaShort.toFixed(2)} > long ${emaLong.toFixed(2)})`,
          `MACD momentum bullish (histogram ${macd.histogram.toFixed(4)})`,
          `Price ${close.toFixed(2)} at/below lower Bollinger Band ${bands.lower.toFixed(2)}`,
          `RSI ${rsi.toFixed(2)} not overbought (< ${config.rsiOverbought})`,
        ].join('; '),
      spend: 'all',
      when: ({bands, close, config, emaLong, emaShort, macd, rsi}) =>
        emaShort > emaLong && macd.histogram > 0 && close <= bands.lower && rsi < config.rsiOverbought,
    },
  },
  markets: [MarketType.BULLISH, MarketType.BEARISH],
  name: '@typedtrader/strategy-multi-indicator-confluence',
});
