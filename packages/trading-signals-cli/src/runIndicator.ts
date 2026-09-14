import {IndicatorInputShape, type IndicatorInputShapes} from 'trading-signals';
import type {Indicator} from './indicators.js';
import type {PriceField, Series} from './parseSeries.js';

export interface IndicatorRun {
  /** The instance that produced the results, so callers can ask it for a signal. */
  indicator: Indicator;
  /** What the indicator was fed: whole candles, or one value per bar taken from this field. */
  input: 'candle' | PriceField;
  required: number;
  results: unknown[];
}

/**
 * The candle fields behind each declared shape. An empty list means the indicator takes a single
 * value per bar rather than a candle.
 */
const FIELDS_BY_SHAPE: Record<IndicatorInputShapes, readonly PriceField[]> = {
  [IndicatorInputShape.HIGH_LOW]: ['high', 'low'],
  [IndicatorInputShape.HIGH_LOW_CLOSE]: ['high', 'low', 'close'],
  [IndicatorInputShape.HIGH_LOW_CLOSE_VOLUME]: ['high', 'low', 'close', 'volume'],
  [IndicatorInputShape.OPEN_HIGH_LOW_CLOSE]: ['open', 'high', 'low', 'close'],
  [IndicatorInputShape.OPEN_HIGH_LOW_CLOSE_VOLUME]: ['open', 'high', 'low', 'close', 'volume'],
  [IndicatorInputShape.VALUE]: [],
};

/*
 * A value series is a plain number per bar, and the library does not say which series: closes for a
 * price indicator, volumes for these three. Nothing in the type system separates them, so the list
 * lives here, with the consumer that has to choose a field. Feeding closes to Volume Rate of Change
 * yields a reading that looks perfectly sound, which is why it is worth naming them.
 */
const VOLUME_SERIES: ReadonlySet<string> = new Set(['PVO', 'RVOL', 'VROC']);

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

function requireField(series: Series, field: PriceField, chosenByCaller = false): void {
  const missing = series.candles.findIndex(candle => candle[field] === undefined);
  if (missing !== -1) {
    throw new Error(
      chosenByCaller
        ? `Not every input carries a "${field}" price.`
        : `The indicator reads "${field}", which input ${missing + 1} does not carry.`
    );
  }
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

/**
 * Every indicator declares which part of a candle it consumes, so the command feeds exactly that:
 * whole candles to the ones reading several fields, closes to a price series, volumes to a volume
 * series. That declaration is the only way to tell the last two apart, because both take a plain
 * number, and feeding closes to Volume Rate of Change yields a reading that looks perfectly sound.
 */
export function runIndicator(create: () => Indicator, series: Series, price: PriceField, name = ''): IndicatorRun {
  const indicator = create();
  const shape = indicator.inputShape;
  if (shape === undefined) {
    throw new Error('The indicator does not declare which input it takes. Update the trading-signals package.');
  }
  const fields = FIELDS_BY_SHAPE[shape];

  if (fields.length > 0) {
    if (series.pricesOnly) {
      throw new Error(`The indicator reads candle fields (${fields.join(', ')}), but the input holds plain prices.`);
    }
    for (const field of fields) {
      requireField(series, field);
    }
    const run = feed(indicator, series.candles);
    /*
     * Only the reading that gets reported has to be usable. An early window can divide by a zero
     * that later windows do not have, and rejecting the run for it would refuse data the indicator
     * recovers from; printing every reading (--all) is where they all have to hold up.
     */
    assertUsable([run.indicator.getResult()], 'The indicator computed no number. Check its arguments.');
    return {...run, input: 'candle'};
  }

  const readsVolume = VOLUME_SERIES.has(name);
  const field: PriceField = readsVolume ? 'volume' : price;
  requireField(series, field, !readsVolume);
  const run = feed(
    indicator,
    series.candles.map(candle => candle[field])
  );
  assertUsable(
    [run.indicator.getResult()],
    `The indicator computed no number from the ${field} values. Check its arguments.`
  );
  return {...run, input: field};
}
