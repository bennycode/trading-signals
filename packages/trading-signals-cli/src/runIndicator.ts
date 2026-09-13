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

function hasNaN(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isNaN(value);
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).some(hasNaN);
  }
  return false;
}

/**
 * Some indicators take one price per bar, others a whole candle, and which one is a type in the
 * library rather than anything readable at runtime. Feeding the wrong flavour is not reliably
 * loud either: an indicator reading `high` off a number gets undefined and returns NaN, but one
 * dividing by a NaN sum may land on a plausible-looking zero.
 *
 * So the indicator is asked instead of guessed: it runs against a candle behind a Proxy that
 * records the fields it reads. A price indicator coerces that object to a number (through
 * Symbol.toPrimitive) and reads no field at all. The probe runs past the warm-up because an
 * indicator that only collects inputs, or that compares a bar to the one before it, touches no
 * field on the first bar.
 */
function readsCandleFields(create: () => Indicator, candle: Candle, required: number): boolean {
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
  for (let bar = 0; bar < required + 2 && !readsField; bar++) {
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

  if (readsCandleFields(create, first, required)) {
    if (series.pricesOnly) {
      throw new Error(
        'The indicator reads candle fields, but the input holds plain prices. Pipe objects with high, low, open, and volume.'
      );
    }
    const run = feed(create(), series.candles);
    if (run.results.some(hasNaN)) {
      throw new Error(
        'The indicator computed no number. It either reads a candle field the input does not carry (high, low, open, volume), or its arguments are incomplete.'
      );
    }
    return {...run, input: 'candle'};
  }

  if (series.candles.some(candle => candle[price] === undefined)) {
    throw new Error(`Not every input carries a "${price}" price.`);
  }
  const run = feed(
    create(),
    series.candles.map(candle => candle[price])
  );
  if (run.results.some(hasNaN)) {
    throw new Error(`The indicator computed no number from the ${price} prices. Check its arguments.`);
  }
  return {...run, input: price};
}

function feed(indicator: Indicator, inputs: readonly unknown[]) {
  const results = inputs.map(input => indicator.update(input, false));
  return {indicator, required: indicator.getRequiredInputs(), results};
}
