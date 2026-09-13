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

function assertUsable(results: readonly unknown[], onNaN: string): void {
  for (const result of results) {
    const unusable = findUnusable(result);
    if (unusable === 'infinite') {
      throw new Error(
        'The indicator computed an infinite value, which happens when the input drives one of its divisors to zero.'
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
function readsCandleFields(create: () => Indicator, candle: Candle, bars: number): boolean {
  let readsField = false;
  const probe: Candle = {};
  for (const field of PRICE_FIELDS) {
    /*
     * Non-enumerable on purpose: indicators clone their state between bars, and structuredClone
     * copies own enumerable properties only. A hidden getter is therefore read when the indicator
     * reaches for a price, but not when it merely carries the candle along.
     */
    Object.defineProperty(probe, field, {
      configurable: true,
      enumerable: false,
      get() {
        readsField = true;
        return candle[field];
      },
    });
  }

  const indicator = create();
  for (let bar = 0; bar < bars && !readsField; bar++) {
    try {
      indicator.update(probe, false);
    } catch {
      // An indicator that rejects the probe has read whatever it needed to reject it.
      break;
    }
  }
  return readsField;
}

export function runIndicator(create: () => Indicator, series: Series, price: PriceField): IndicatorRun {
  const required = create().getRequiredInputs();
  const [first] = series.candles;

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

  if (readsCandleFields(create, first, probeBars)) {
    if (series.pricesOnly) {
      throw new Error(
        'The indicator reads candle fields, but the input holds plain prices. Pipe objects with high, low, open, and volume.'
      );
    }
    const run = feed(create(), series.candles);
    assertUsable(
      run.results,
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
  assertUsable(run.results, `The indicator computed no number from the ${price} prices. Check its arguments.`);
  return {...run, input: price};
}

function feed(indicator: Indicator, inputs: readonly unknown[]) {
  const results = inputs.map(input => indicator.update(input, false));
  return {indicator, required: indicator.getRequiredInputs(), results};
}
