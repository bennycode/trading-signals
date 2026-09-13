/** The candle fields `trading-signals` reads, as far as they are present in the input. */
export const PRICE_FIELDS = ['close', 'high', 'low', 'open', 'volume'] as const;

export type PriceField = (typeof PRICE_FIELDS)[number];

export type Candle = Partial<Record<PriceField, number>>;

export interface Series {
  candles: Candle[];
  /** True when the input was plain numbers, so there is nothing but the price to feed. */
  pricesOnly: boolean;
}

function toNumber(value: unknown, context: string): number {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(`${context} is not a number: ${JSON.stringify(value)}`);
  }
  return parsed;
}

function toCandle(value: object, position: number): Candle {
  const candle: Candle = {};
  for (const field of PRICE_FIELDS) {
    if (field in value) {
      // Brokers report prices as strings to keep their precision, so both spellings are accepted.
      candle[field] = toNumber(Reflect.get(value, field), `Input ${position}: "${field}"`);
    }
  }
  if (candle.close === undefined) {
    throw new Error(`Input ${position} has no "close" price: ${JSON.stringify(value)}`);
  }
  return candle;
}

function parseArray(text: string): unknown[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error('The input is a JSON value but not an array of candles or prices.');
  }
  return parsed;
}

function parseLines(text: string): unknown[] {
  const items: unknown[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    // A candle, or a quoted price as brokers write it, is one JSON value per line; bare numbers may share a line.
    if (trimmed.startsWith('{') || trimmed.startsWith('"')) {
      const parsed: unknown = JSON.parse(trimmed);
      items.push(parsed);
    } else {
      items.push(...trimmed.split(/\s+/));
    }
  }
  return items;
}

/**
 * Reads a JSON array, newline-delimited JSON, or whitespace-separated numbers. Candle objects may
 * carry any subset of the price fields as long as they have a close; an indicator that needs a
 * field the input does not carry is reported rather than silently computed from undefined values.
 */
export function parseSeries(text: string): Series {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('No input data. Pipe candles or prices into the command, or pass --input <file>.');
  }

  const items = trimmed.startsWith('[') ? parseArray(trimmed) : parseLines(trimmed);
  if (items.length === 0) {
    throw new Error('No input data.');
  }

  const candles = items.map((item, index) =>
    item !== null && typeof item === 'object'
      ? toCandle(item, index + 1)
      : {close: toNumber(item, `Input ${index + 1}`)}
  );
  return {candles, pricesOnly: candles.every(candle => Object.keys(candle).length === 1)};
}
