import {parseArgs} from 'node:util';
import {IndicatorInputShape, TechnicalIndicator, type IndicatorInputShapes} from '../base/Indicator.js';
import * as library from '../index.js';

/**
 * A candle row from any input source, already parsed into named fields. Field values stay
 * strings until the indicator's input shape decides which ones are needed as numbers.
 */
type CandleRow = Record<string, string>;

type AnyIndicator = TechnicalIndicator<unknown, unknown>;

/**
 * The parameter list is deliberately loose: constructor arguments arrive from the command
 * line, and the type predicate below vouches for the class itself, not its arity — a wrong
 * parameter count surfaces as the indicator's own constructor error.
 */
interface IndicatorConstructor {
  new (...args: unknown[]): AnyIndicator;
}

function isIndicatorConstructor(value: unknown): value is IndicatorConstructor {
  /*
   * Abstract base classes (MovingAverage, ZeroCrossSeries, ...) are exported too, but their
   * abstract `update` does not exist at runtime — a concrete indicator is one whose
   * prototype chain actually carries an implementation.
   */
  return (
    typeof value === 'function' &&
    value.prototype instanceof TechnicalIndicator &&
    typeof value.prototype.update === 'function'
  );
}

/**
 * MACD and BollingerBandsWidth take other indicator instances instead of plain numbers, so
 * generic construction from command-line parameters cannot wire them. These factories
 * translate flat numeric parameters into the wired-up dependencies; every other indicator
 * constructs generically.
 */
const INDICATOR_FACTORIES: Record<string, (numbers: number[]) => AnyIndicator> = {
  bollingerbandswidth: numbers => {
    const [interval, deviationMultiplier] = numbers;

    if (interval === undefined) {
      throw new Error('bollingerbandswidth needs parameters: <interval> [deviationMultiplier].');
    }

    return new library.BollingerBandsWidth(
      deviationMultiplier === undefined
        ? new library.BollingerBands(interval)
        : new library.BollingerBands(interval, deviationMultiplier)
    );
  },
  macd: numbers => {
    const [short, long, signal] = numbers;

    if (short === undefined || long === undefined || signal === undefined) {
      throw new Error('macd needs three parameters: <shortInterval> <longInterval> <signalInterval>.');
    }

    return new library.MACD(new library.EMA(short), new library.EMA(long), new library.EMA(signal));
  },
};

/** Every exported concrete indicator, resolved generically from the package's exports. */
function getIndicatorRegistry(): Map<string, IndicatorConstructor> {
  const registry = new Map<string, IndicatorConstructor>();
  const exports: Record<string, unknown> = library;

  for (const [name, value] of Object.entries(exports)) {
    if (isIndicatorConstructor(value)) {
      registry.set(name.toLowerCase(), value);
    }
  }

  return registry;
}

export const USAGE = () => `Usage: trading-signals <indicator> [params...] [options]

Computes an indicator over candles piped to stdin or read from --csv. Params are the
indicator's constructor arguments: plain numbers are passed positionally, key=value pairs
are collected into a single config object (dotted keys nest, e.g. signalThresholds.overbought=4).

  cat candles.csv | trading-signals sma 20
  trading-signals atr 14 --csv candles.csv
  trading-signals macd 12 26 9 --csv candles.csv
  exchange-cli watch-candles AAPL ... | trading-signals ema 20
  trading-signals stochasticoscillator kPeriod=5 dPeriod=3 kSlowingPeriod=3 --csv candles.csv
  trading-signals pgo interval=14 signalThresholds.overbought=4 --csv candles.csv

Input formats (auto-detected): CSV with a header row, NDJSON (one candle object per line),
or a JSON array of candles. Recognized fields: open/high/low/close/volume (or o/h/l/c/v)
plus an optional time/date/timestamp passed through to the output.

Output: one JSON object per stable result ({time?, value}), streamed as candles arrive.
With --last, only the final value is printed.

Options:
  --csv <file>  Read candles from a file instead of stdin
  --last        Print only the final value instead of streaming every result

Available indicators:
${wrapList([...getIndicatorRegistry().keys()].sort())}`;

function wrapList(names: string[]): string {
  const lines: string[] = [];
  let line = ' ';

  for (const name of names) {
    if (line.length + name.length + 1 > 100) {
      lines.push(line);
      line = ' ';
    }
    line += ` ${name}`;
  }
  lines.push(line);

  return lines.join('\n');
}

/** Dotted keys nest one level, so config objects like {signalThresholds: {overbought}} stay reachable from the command line. */
function setConfigValue(config: Record<string, unknown>, path: string, value: number): void {
  const separator = path.indexOf('.');

  if (separator === -1) {
    config[path] = value;
    return;
  }

  const outer = path.slice(0, separator);
  const inner = path.slice(separator + 1);
  const nested = config[outer];

  if (isRecord(nested)) {
    nested[inner] = value;
  } else {
    config[outer] = {[inner]: value};
  }
}

/** Splits CLI parameters into numeric positionals and one optional config object built from key=value pairs. */
export function parseConstructorArgs(params: string[]): {
  config: Record<string, unknown> | undefined;
  numbers: number[];
} {
  const numbers: number[] = [];
  const config: Record<string, unknown> = {};
  let hasConfig = false;

  for (const param of params) {
    const separator = param.indexOf('=');

    if (separator === -1) {
      const value = Number(param);

      if (Number.isNaN(value)) {
        throw new Error(`Invalid indicator parameter "${param}". Use a number or key=value.`);
      }
      numbers.push(value);
    } else {
      const key = param.slice(0, separator);
      const value = Number(param.slice(separator + 1));

      if (Number.isNaN(value)) {
        throw new Error(`Invalid indicator parameter "${param}". The value has to be a number.`);
      }
      setConfigValue(config, key, value);
      hasConfig = true;
    }
  }

  return {config: hasConfig ? config : undefined, numbers};
}

const FIELD_ALIASES: Record<string, string> = {
  c: 'close',
  h: 'high',
  l: 'low',
  o: 'open',
  v: 'volume',
};

function normalizeRow(row: Record<string, unknown>): CandleRow {
  const normalized: CandleRow = {};

  for (const [key, value] of Object.entries(row)) {
    const lower = key.toLowerCase();
    normalized[FIELD_ALIASES[lower] ?? lower] = String(value);
  }

  return normalized;
}

function requireField(row: CandleRow, field: string): number {
  const raw = row[field];
  // Number('') is 0, so an empty CSV cell must not silently pass as a valid zero.
  const value = raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`Candle is missing a numeric "${field}" field: ${JSON.stringify(row)}`);
  }

  return value;
}

/** Maps a candle row to the exact input the indicator's declared shape consumes. */
function toIndicatorInput(shape: IndicatorInputShapes, row: CandleRow): unknown {
  switch (shape) {
    case IndicatorInputShape.VALUE:
      return requireField(row, 'close');
    case IndicatorInputShape.VOLUME:
      return requireField(row, 'volume');
    case IndicatorInputShape.HIGH_LOW:
      return {high: requireField(row, 'high'), low: requireField(row, 'low')};
    case IndicatorInputShape.HIGH_LOW_CLOSE:
      return {close: requireField(row, 'close'), high: requireField(row, 'high'), low: requireField(row, 'low')};
    case IndicatorInputShape.HIGH_LOW_CLOSE_VOLUME:
      return {
        close: requireField(row, 'close'),
        high: requireField(row, 'high'),
        low: requireField(row, 'low'),
        volume: requireField(row, 'volume'),
      };
    case IndicatorInputShape.OPEN_HIGH_LOW_CLOSE:
      return {
        close: requireField(row, 'close'),
        high: requireField(row, 'high'),
        low: requireField(row, 'low'),
        open: requireField(row, 'open'),
      };
    case IndicatorInputShape.OPEN_HIGH_LOW_CLOSE_VOLUME:
      return {
        close: requireField(row, 'close'),
        high: requireField(row, 'high'),
        low: requireField(row, 'low'),
        open: requireField(row, 'open'),
        volume: requireField(row, 'volume'),
      };
  }
}

function getTime(row: CandleRow): string | undefined {
  return row.time ?? row.opentimeiniso ?? row.date ?? row.timestamp;
}

/** Splits a CSV line honoring double-quoted cells, including commas inside quotes and "" escapes. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === ',') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());

  return cells;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accepts one parsed candle object or an array of them; anything else is a malformed input. */
function toRecords(value: unknown): Record<string, unknown>[] {
  const entries = Array.isArray(value) ? value : [value];

  return entries.map(entry => {
    if (!isRecord(entry)) {
      throw new Error(`Expected candle objects, got: ${JSON.stringify(entry)?.slice(0, 80)}`);
    }

    return entry;
  });
}

/**
 * Turns raw input lines into candle rows, streaming. The format is decided by the first
 * non-empty line: "[" buffers a JSON array, "{" treats every line as one NDJSON candle,
 * anything else is CSV whose first line is the header.
 */
async function* parseCandleRows(lines: AsyncIterable<string>): AsyncGenerator<CandleRow> {
  let format: 'csv' | 'json-array' | 'ndjson' | undefined;
  let header: string[] | undefined;
  const buffered: string[] = [];

  for await (const line of lines) {
    const trimmed = line.trim();

    if (format === undefined) {
      if (trimmed === '') {
        continue;
      }
      format = trimmed.startsWith('[') ? 'json-array' : trimmed.startsWith('{') ? 'ndjson' : 'csv';
    }

    if (format === 'json-array') {
      buffered.push(line);
      continue;
    }

    if (trimmed === '') {
      continue;
    }

    if (format === 'ndjson') {
      for (const record of toRecords(JSON.parse(trimmed))) {
        yield normalizeRow(record);
      }
    } else if (header === undefined) {
      header = parseCsvLine(trimmed).map(column => column.toLowerCase());
    } else {
      const cells = parseCsvLine(trimmed);
      yield normalizeRow(Object.fromEntries(header.map((column, index) => [column, cells[index]])));
    }
  }

  if (format === 'json-array') {
    for (const record of toRecords(JSON.parse(buffered.join('\n')))) {
      yield normalizeRow(record);
    }
  }
}

/**
 * Runs the CLI: resolves the indicator generically from the package exports, feeds it every
 * candle from the input, and writes one JSON line per stable result (or only the final one
 * with --last). Input arrives as an async iterable of lines so streaming sources (a live
 * candle feed piped in) produce output as candles arrive.
 */
export async function runCli(
  argv: string[],
  readLines: () => AsyncIterable<string>,
  writeLine: (line: string) => void
): Promise<void> {
  const {values, positionals} = parseArgs({
    allowPositionals: true,
    args: argv,
    options: {
      csv: {type: 'string'},
      last: {default: false, type: 'boolean'},
    },
  });

  const [name, ...params] = positionals;

  if (!name || name === 'help') {
    writeLine(USAGE());
    return;
  }

  const registry = getIndicatorRegistry();
  const IndicatorClass = registry.get(name.toLowerCase());

  if (!IndicatorClass) {
    throw new Error(`Unknown indicator "${name}". Run "trading-signals help" to list the available ones.`);
  }

  const {config, numbers} = parseConstructorArgs(params);
  const factory = INDICATOR_FACTORIES[name.toLowerCase()];
  const indicator = factory
    ? factory(numbers)
    : new IndicatorClass(...(config === undefined ? numbers : [...numbers, config]));
  let lastResult: unknown;
  let lastTime: string | undefined;

  for await (const row of parseCandleRows(readLines())) {
    const result = indicator.add(toIndicatorInput(indicator.inputShape, row));

    if (result === null) {
      continue;
    }
    lastResult = result;
    lastTime = getTime(row);

    if (!values.last) {
      const time = getTime(row);
      writeLine(JSON.stringify(time === undefined ? {value: result} : {time, value: result}));
    }
  }

  if (values.last) {
    if (lastResult === undefined) {
      throw new Error(`Not enough candles: "${name}" needs ${indicator.getRequiredInputs()} inputs to become stable.`);
    }
    writeLine(JSON.stringify(lastTime === undefined ? {value: lastResult} : {time: lastTime, value: lastResult}));
  }
}
