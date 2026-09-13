import type {Indicator} from './indicators.js';
import {PRICE_FIELDS, type Candle, type PriceField, type Series} from './parseSeries.js';

export interface IndicatorRun {
  /** The instance that produced the results, so callers can ask it for a signal. */
  indicator: Indicator;
  /** Which flavour of input the indicator read: whole candles or a single price per bar. */
  input: 'candle' | PriceField;
  required: number;
  results: unknown[];
}

/**
 * NaN and Infinity both survive to the output as `null` once JSON.stringify is done with them,
 * which would pair an empty result with `stable: true`. They arise for different reasons, so they
 * are told apart rather than lumped together.
 */
function findUnusable(value: unknown): 'infinite' | 'not a number' | undefined {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return 'not a number';
    }
    return Number.isFinite(value) ? undefined : 'infinite';
  }
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) {
      const unusable = findUnusable(entry);
      if (unusable) {
        return unusable;
      }
    }
  }
  return undefined;
}

export function assertUsable(results: readonly unknown[], onNaN: string): void {
  for (const result of results) {
    const unusable = findUnusable(result);
    if (unusable === 'infinite') {
      throw new Error(
        'The indicator computed an infinite value, which happens when a value overflows or one of its divisors reaches zero.'
      );
    }
    if (unusable) {
      throw new Error(onNaN);
    }
  }
}

/**
 * Some indicators take one price per bar, others a whole candle, and which one is a type in the
 * library rather than anything readable at runtime. Feeding the wrong flavour is not reliably
 * loud either: an indicator reading `high` off a number gets undefined and returns NaN, but one
 * dividing by a NaN sum may land on a plausible-looking zero.
 *
 * So the indicator is asked instead of guessed: it runs against a candle whose prices sit behind
 * getters that record being read. A price indicator coerces that object to a number instead and
 * reads no field at all. Indicators differ in how long they collect inputs before reaching for a
 * price (Ichimoku Cloud takes 52 bars), hence a probe that runs until the warm-up is over.
 */
function readCandleFields(create: () => Indicator, candles: readonly Candle[], bars: number): Set<PriceField> {
  const read = new Set<PriceField>();
  /*
   * Non-enumerable on purpose: indicators clone their state between bars, and structuredClone
   * copies own enumerable properties only. A hidden getter is therefore read when the indicator
   * reaches for a price, but not when it merely carries the candle along.
   */
  const watch = (candle: Candle): Candle => {
    const probe: Candle = {};
    for (const field of PRICE_FIELDS) {
      Object.defineProperty(probe, field, {
        configurable: true,
        enumerable: false,
        get() {
          read.add(field);
          return candle[field];
        },
      });
    }
    return probe;
  };

  const indicator = create();
  for (let bar = 0; bar < bars; bar++) {
    /*
     * The real bars, because a field can sit behind a branch the data decides: a breakout reaches
     * for the low of the bar that broke out, and repeating one candle never breaks out. A series
     * shorter than the probe repeats from the start, which is only the single-bar case.
     */
    try {
      indicator.update(watch(candles[bar % candles.length]), false);
    } catch {
      // An indicator that rejects the probe has read whatever it needed to reject it.
      break;
    }
  }
  return read;
}

export function runIndicator(create: () => Indicator, series: Series, price: PriceField): IndicatorRun {
  const required = create().getRequiredInputs();

  /*
   * Never probe for longer than the series itself: the warm-up comes from a user-supplied interval,
   * so `sma 1000000000` would otherwise run a billion synthetic bars. An indicator that reads no
   * price within the data it is about to be given cannot produce a result from it either.
   *
   * Two bars regardless, because the indicators that compare a bar to the one before it read
   * nothing on the first while already emitting a value (NVI starts its index at 1000). A single
   * bar would classify those as price indicators and hand them a number they cannot read.
   */
  const probeBars = Math.max(2, Math.min(required + 2, series.candles.length));

  const fieldsRead = readCandleFields(create, series.candles, probeBars);
  if (fieldsRead.size > 0) {
    if (series.pricesOnly) {
      throw new Error(
        `The indicator reads candle fields (${[...fieldsRead].join(', ')}), but the input holds plain prices.`
      );
    }
    /*
     * A field the input does not carry reaches the indicator as undefined, and a comparison against
     * undefined is merely false rather than an error: NVI keeps its index at 1000 and reports that
     * as a reading. The fields the probe saw it reach for therefore have to be present on every bar.
     */
    for (const field of fieldsRead) {
      const missing = series.candles.findIndex(candle => candle[field] === undefined);
      if (missing !== -1) {
        throw new Error(`The indicator reads "${field}", which input ${missing + 1} does not carry.`);
      }
    }
    const run = feed(create(), series.candles);
    /*
     * Only the reading that gets reported has to be usable. An early window can divide by a zero
     * that later windows do not have, and rejecting the run for it would refuse data the indicator
     * recovers from; printing every reading (--all) is where they all have to hold up.
     */
    assertUsable(
      [run.indicator.getResult()],
      'The indicator computed no number. It either reads a candle field the input does not carry (high, low, open, volume), or its arguments are incomplete.'
    );
    return {...run, input: 'candle'};
  }

  if (series.candles.some(candle => candle[price] === undefined)) {
    throw new Error(`Not every input carries a "${price}" price.`);
  }
  const run = feed(
    create(),
    series.candles.map(candle => candle[price])
  );
  assertUsable(
    [run.indicator.getResult()],
    `The indicator computed no number from the ${price} prices. Check its arguments.`
  );
  return {...run, input: price};
}

function feed(indicator: Indicator, inputs: readonly unknown[]) {
  /*
   * An argument of the wrong shape can pass every check and still break here, because an indicator
   * may keep it untouched until a bar arrives: StochasticRSI stores its pair of smoothing averages
   * and reaches for them on the first update. The raw failure says nothing about where it came
   * from, so it is given its context back.
   */
  try {
    const results = inputs.map(input => indicator.update(input, false));
    return {indicator, required: indicator.getRequiredInputs(), results};
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`The indicator failed on the input: ${reason}. One of its arguments has the wrong shape.`);
  }
}
