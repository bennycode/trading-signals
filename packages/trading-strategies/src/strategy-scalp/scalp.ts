import Big from 'big.js';
import {z} from 'zod';
import type {Candle} from '@typedtrader/exchange';
import {EMA, ER} from 'trading-signals';
import {defineStrategy, every, fromHistory, ProtectionSchema, required, protection} from '../engine/index.js';
import {MarketType} from '../strategy/MarketType.js';
import {positiveNumberString} from '../util/validators.js';
import {suggestScalpOffset} from './suggestScalpOffset.js';

export const ScalpSchema = ProtectionSchema.extend({
  /** Period of the moving average the first entry waits to be above. */
  emaPeriod: z.number().int().positive().default(5),
  /**
   * Nominal price distance of each leg: sell at the entry fill plus this, re-buy at the exit fill
   * minus it. Omit it to have one derived from how far the instrument actually moves in a day.
   */
  offset: positiveNumberString.optional(),
});

export type ScalpConfig = z.input<typeof ScalpSchema>;
type Settings = z.output<typeof ScalpSchema>;

/**
 * Days of daily bars the offset and the trend check are derived from. Enough that market holidays
 * and shortened weeks cannot leave either of them short of data.
 */
const HISTORY_DAYS = 30;

/** Bars both the Efficiency Ratio and the ATR behind the offset need before they mean anything. */
const MINIMUM_BARS = 14;

/**
 * Efficiency Ratio above which the instrument is trending rather than ranging. Scalping a trend
 * means selling a position that keeps going up, or re-buying one that keeps going down.
 */
export const ER_THRESHOLD = 0.4;

function isRangeBound(candles: Candle[]): boolean {
  const er = new ER(candles.length);

  for (const candle of candles) {
    er.add({close: parseFloat(candle.close), high: parseFloat(candle.high), low: parseFloat(candle.low)});
  }

  return er.getResultOrThrow() < ER_THRESHOLD;
}

/**
 * The distance both legs are priced off, or `undefined` when this instrument should not be
 * scalped at all — which is also what every rule reading it needs, since a rule cannot read an
 * absent fact and therefore never fires.
 */
function scalpOffset(candles: Candle[], config: Settings): Big | undefined {
  if (candles.length < MINIMUM_BARS) {
    /*
     * Without enough history there is nothing to judge the instrument on. A configured offset is
     * still the user's to use; a derived one would be guesswork.
     */
    return config.offset === undefined ? undefined : new Big(config.offset);
  }

  if (!isRangeBound(candles)) {
    return undefined;
  }

  return config.offset === undefined ? suggestScalpOffset(candles, MINIMUM_BARS) : new Big(config.offset);
}

/**
 * Both legs are priced off the offset, so an entry made without one would leave a position no
 * rule could close. Reading the offset is what refuses that entry: a strategy that decided
 * against scalping this instrument has no offset to read, and a rule cannot fire on a fact it
 * cannot read.
 */
function canScalp(facts: {offset: Big}): boolean {
  return facts.offset.gt(0);
}

/**
 * Takes the same small bite over and over: enters once price is above its moving average, offers
 * the position back at the entry fill plus an offset, and on the way down re-buys at the exit fill
 * minus the same offset. Both legs are limit orders, so the offset is the margin per round trip.
 *
 * It only runs where that works. A trending instrument is refused outright, because there the
 * strategy sells a position that keeps rising and buys one that keeps falling.
 */
export const Scalp = defineStrategy(ScalpSchema)({
  indicators: {
    ema: every('1m', config => new EMA(config.emaPeriod)),
    offset: fromHistory(HISTORY_DAYS, '1d', scalpOffset),
  },
  long: {
    close: [
      ...protection<Settings>(),
      {
        /*
         * Priced off what the position cost per unit held rather than off the fill price: a fee
         * taken in the base asset leaves fewer units than were paid for, and this leg has to clear
         * what they cost to be worth selling.
         */
        because: ({offset, position}) =>
          `Scalp sell: cost ${required(position, 'position').entryPrice.toFixed(2)} + offset ${offset.toFixed(2)}`,
        limit: ({offset, position}) => required(position, 'position').entryPrice.plus(offset),
        quantity: 'all',
        when: 'always',
      },
    ],
    open: [
      {
        because: ({close, config, ema}) =>
          `Entry: price ${close.toFixed(2)} above EMA(${config.emaPeriod}) ${ema.toFixed(2)}`,
        spend: 'all',
        when: facts => facts.lastExit === null && canScalp(facts) && facts.close > facts.ema,
      },
      {
        because: ({lastExit, offset}) =>
          `Scalp buy: fill ${required(lastExit, 'last exit').price.toFixed(2)} - offset ${offset.toFixed(2)}`,
        limit: ({lastExit, offset}) => required(lastExit, 'last exit').price.minus(offset),
        spend: 'all',
        /*
         * Phased on the last exit rather than on the entry count, because a position this strategy
         * adopted rather than opened leaves no entry behind: counting entries would send it back
         * to the EMA rule, which buys at market instead of waiting an offset below the exit.
         */
        /*
         * Phased on the last exit rather than on the entry count, because a position this strategy
         * adopted rather than opened leaves no entry behind: counting entries would send it back
         * to the EMA rule, which buys at market instead of waiting an offset below the exit.
         */
        when: ({lastExit}) => lastExit !== null,
      },
    ],
  },
  markets: [MarketType.RANGING],
  name: '@typedtrader/strategy-scalp',
});
