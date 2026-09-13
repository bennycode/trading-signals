import * as library from 'trading-signals';

export interface Indicator {
  getRequiredInputs(): number;
  getResult(): unknown;
  getSignal?(): unknown;
  update(input: unknown, replace: boolean): unknown;
}

type IndicatorClass = new (...args: unknown[]) => Indicator;

/*
 * Indicators are discovered from the package's own exports instead of being listed here, so a new
 * indicator in `trading-signals` is available on the command line without a change in this package.
 * Abstract base classes drop out on their own: their `update` stays abstract, so it never lands on
 * the prototype.
 */
function isIndicatorClass(value: unknown): value is IndicatorClass {
  if (typeof value !== 'function') {
    return false;
  }
  const prototype: unknown = Reflect.get(value, 'prototype');
  if (prototype === null || typeof prototype !== 'object') {
    return false;
  }
  const update: unknown = Reflect.get(prototype, 'update');
  return typeof update === 'function';
}

function collectIndicators() {
  const indicators = new Map<string, IndicatorClass>();
  for (const [name, value] of Object.entries(library)) {
    if (isIndicatorClass(value)) {
      indicators.set(name, value);
    }
  }
  return indicators;
}

const INDICATORS = collectIndicators();
const BY_LOWERCASE_NAME = new Map(Array.from(INDICATORS, ([name, value]) => [name.toLowerCase(), {name, value}]));

/** Indicator names in the order `trading-signals` exports them, optionally narrowed by a substring. */
export function listIndicators(query = ''): string[] {
  const needle = query.toLowerCase();
  return Array.from(INDICATORS.keys()).filter(name => name.toLowerCase().includes(needle));
}

export function findIndicator(name: string) {
  const found = BY_LOWERCASE_NAME.get(name.toLowerCase());
  if (!found) {
    throw new Error(`Unknown indicator "${name}". Use list to see the available ones.`);
  }
  return found;
}

/**
 * Turns one command-line argument into a constructor argument:
 *
 * - `WSMA` (an indicator name) becomes the class itself, for arguments like ATR's smoothing indicator
 * - `EMA:12` becomes `new EMA(12)`, for arguments like MACD's three moving averages
 * - everything else is read as JSON (`14`, `{"baseInterval":26}`)
 *
 * No indicator takes a plain string, so an argument that is none of the three is rejected instead
 * of being handed over: constructors accept it silently and then report nonsense.
 */
function parseArgument(argument: string): unknown {
  const [head, tail] = argument.split(':', 2);
  const indicator = BY_LOWERCASE_NAME.get(head.toLowerCase());
  if (indicator) {
    return tail === undefined ? indicator.value : new indicator.value(...tail.split(',').map(parseArgument));
  }
  try {
    return JSON.parse(argument);
  } catch {
    throw new Error(`Cannot read the argument "${argument}". Pass a number, a JSON value, or an indicator name.`);
  }
}

export function createIndicator(name: string, args: string[]): {create: () => Indicator; name: string} {
  const {name: exportedName, value: IndicatorConstructor} = findIndicator(name);
  /*
   * Both input flavours are tried (see runIndicator), and an indicator carries state from the
   * first attempt into the second, so each attempt needs its own instance.
   */
  const create = () => new IndicatorConstructor(...args.map(parseArgument));

  /*
   * Indicators take their settings in whichever shape suits them (an interval, several, a config
   * object, other indicators) and do not validate them, so wrong arguments surface as an impossible
   * number of required inputs instead of a constructor error. Probing that here keeps a bad call
   * from being reported as a result.
   */
  const describe = `${exportedName} cannot run with [${args.join(', ')}]`;
  let required: number;
  try {
    required = create().getRequiredInputs();
  } catch (error) {
    throw new Error(`${describe}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Number.isInteger(required) || required < 1) {
    throw new Error(
      `${describe}: they leave it needing "${required}" inputs. Check the arguments this indicator expects, such as an interval ("sma 20") or a config ("psar {\\"accelerationStep\\":0.02}").`
    );
  }
  return {create, name: exportedName};
}
