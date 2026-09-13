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

/**
 * `Period` tracks the highest and lowest value of a window. It is a building block the indicators
 * use, not a technical indicator itself, and it is concrete enough to pass for one.
 */
const HELPERS: ReadonlySet<string> = new Set(['Period']);

function collectIndicators() {
  const indicators = new Map<string, IndicatorClass>();
  for (const [name, value] of Object.entries(library)) {
    if (isIndicatorClass(value) && !HELPERS.has(name)) {
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

/**
 * Names the settings a constructor expects in a config object, or nothing when it takes positional
 * arguments.
 *
 * A constructor that destructures its first parameter reads the settings off it. Handed a number
 * instead, JavaScript boxes that number, the destructuring finds none of the properties, and every
 * default applies: `new SuperTrend(14, 5)` silently runs with an interval of 10 and a multiplier of
 * 3. So the constructor is offered a Proxy and asked which properties it looks for.
 */
function configFields(IndicatorConstructor: new (...args: unknown[]) => Indicator): string[] {
  const fields: string[] = [];
  const probe = new Proxy(
    {},
    {
      get(target, key) {
        /*
         * A positional constructor does arithmetic on its interval, and coercing the probe to a
         * number reads `valueOf` and `toString` off it. Those are not settings, and neither is
         * anything else Object.prototype already answers for.
         */
        if (typeof key === 'string' && !(key in Object.prototype)) {
          fields.push(key);
        }
        const value: unknown = Reflect.get(target, key);
        return value;
      },
    }
  );
  try {
    new IndicatorConstructor(probe);
  } catch {
    // Whatever it read before giving up still tells us it wanted a config.
  }
  return fields;
}

export function createIndicator(name: string, args: string[]): {create: () => Indicator; name: string} {
  const {name: exportedName, value: IndicatorConstructor} = findIndicator(name);
  /*
   * Both input flavours are tried (see runIndicator), and an indicator carries state from the
   * first attempt into the second, so each attempt needs its own instance.
   */
  const create = () => new IndicatorConstructor(...args.map(parseArgument));

  /*
   * Every setting of a config constructor arrives in an object, including the optional second one
   * that some of them take for signal thresholds. Anything else in any position is dropped on the
   * floor by the destructuring, so "supertrend {} 14" would run the defaults and report them as a
   * result.
   */
  const parsed = args.map(parseArgument);
  if (parsed.some(argument => typeof argument !== 'object' || argument === null)) {
    const fields = configFields(IndicatorConstructor);
    if (fields.length > 0) {
      throw new Error(
        `${exportedName} takes its settings in a config object, so [${args.join(', ')}] would leave every default in place. Pass JSON instead, for example {${fields.map(field => `"${field}":…`).join(', ')}}.`
      );
    }
  }

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
