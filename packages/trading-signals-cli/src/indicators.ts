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

/**
 * Indicator names in alphabetical order, optionally narrowed by a substring. Sorted explicitly
 * rather than left to the order the exports are enumerated in: a module namespace hands them over
 * sorted, but a bundler's stand-in for one keeps the order they were declared in, and the command
 * should not print a different list depending on how its input was loaded.
 */
export function listIndicators(query = ''): string[] {
  const needle = query.toLowerCase();
  return Array.from(INDICATORS.keys())
    .filter(name => name.toLowerCase().includes(needle))
    .sort();
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
 * A constructor that destructures a parameter reads the settings off it. Handed a number instead,
 * JavaScript boxes that number, the destructuring finds none of the properties, and every default
 * applies: `new SuperTrend(14, 5)` silently runs with an interval of 10 and a multiplier of 3, and
 * `new CCI(20, 1)` with the default thresholds. So every position the caller filled is offered a
 * Proxy, and the constructor is asked which of them it reads settings from.
 */
export interface ConfigShape {
  /** The settings read off this position. */
  fields: string[];
  /** The settings read inside one of them, for a config that nests, such as signal thresholds. */
  nested: Map<string, string[]>;
}

/*
 * Settings are not settings to `typeof`: a key the constructor never reads looks exactly like one
 * it does. So the read itself is the evidence, one level deep, which is as far as the configs of
 * this library nest.
 */
function isSetting(key: string | symbol): key is string {
  /*
   * A positional constructor does arithmetic on its interval, and coercing the probe to a number
   * reads `valueOf` and `toString` off it. Those are not settings, and neither is anything else
   * Object.prototype already answers for.
   */
  return typeof key === 'string' && !(key in Object.prototype);
}

function configPositions(IndicatorConstructor: new (...args: unknown[]) => Indicator, count: number): ConfigShape[] {
  const shapes: ConfigShape[] = Array.from({length: count}, () => ({fields: [], nested: new Map()}));
  const probes = shapes.map(
    shape =>
      new Proxy(
        {},
        {
          get(_target, key) {
            if (!isSetting(key)) {
              return undefined;
            }
            shape.fields.push(key);
            /*
             * Handing back a recorder rather than undefined lets a nested destructuring run, so a
             * misspelling inside a config object is caught like one at the top level. Its own keys
             * answer undefined, which ends the recursion.
             */
            const nested: string[] = [];
            shape.nested.set(key, nested);
            return new Proxy(
              {},
              {
                get(_nestedTarget, nestedKey) {
                  if (isSetting(nestedKey)) {
                    nested.push(nestedKey);
                  }
                  return undefined;
                },
              }
            );
          },
        }
      )
  );
  try {
    new IndicatorConstructor(...probes);
  } catch {
    // Whatever it read before giving up still tells us which positions wanted a config.
  }
  return shapes;
}

/** An indicator instance passes as an argument (MACD takes three); a bare config object does not. */
function isIndicatorInstance(value: object): boolean {
  return typeof Reflect.get(value, 'update') === 'function';
}

/**
 * How many parameters the constructor that actually runs declares. A value consumed by assignment
 * leaves no trace for a probe to find, so `new SMA(5, 999)` keeps the 999 to itself; the parameter
 * list is the only place the excess shows up.
 *
 * Read from the source of the nearest class that declares a constructor, because a subclass without
 * one inherits it: SMA takes its interval from MovingAverage. An unreadable parameter list, or a
 * chain that declares none at all, yields no limit rather than a guessed one.
 */
function declaredParameterCount(IndicatorConstructor: new (...args: unknown[]) => Indicator): number {
  for (
    let current: unknown = IndicatorConstructor;
    typeof current === 'function';
    current = Object.getPrototypeOf(current)
  ) {
    const source = String(current);
    const start = source.indexOf('constructor(');
    if (start === -1) {
      continue;
    }
    let depth = 0;
    let separators = 0;
    let hasParameter = false;
    for (let index = start + 'constructor'.length; index < source.length; index++) {
      const character = source[index];
      if (character === '(' || character === '[' || character === '{') {
        depth++;
      } else if (character === ')' || character === ']' || character === '}') {
        depth--;
        if (depth === 0) {
          return hasParameter ? separators + 1 : 0;
        }
      } else if (depth === 1) {
        if (character === ',') {
          separators++;
        }
        hasParameter ||= character.trim().length > 0;
      }
    }
    break;
  }
  return Number.POSITIVE_INFINITY;
}

/** Rejects a setting the constructor never reached for, which the destructuring would drop. */
function assertKeysAreRead(subject: string, config: object, fields: readonly string[]): void {
  const unread = Object.keys(config).filter(key => !fields.includes(key));
  if (unread.length > 0) {
    throw new Error(
      `${subject} does not read ${unread.map(key => `"${key}"`).join(', ')}. It expects ${fields.map(field => `"${field}"`).join(', ')}.`
    );
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
   * Settings reach a constructor in an object, and anything else in that position is dropped on the
   * floor by the destructuring, leaving the defaults in place: "supertrend 14 5" and "cci 20 1" are
   * both accepted by JavaScript and both ignore what was asked for. An object in a position the
   * constructor never reads is lost the same way.
   */
  const parsed = args.map(parseArgument);

  const positions = configPositions(IndicatorConstructor, parsed.length);
  const settingsComeAsConfig = (positions[0]?.fields.length ?? 0) > 0;

  const declared = declaredParameterCount(IndicatorConstructor);
  if (parsed.length > declared) {
    const takes = declared === 0 ? 'no arguments' : `${declared} argument${declared === 1 ? '' : 's'}`;
    // Naming the shape as well spares a second attempt when the count was not the only thing wrong.
    const shape = settingsComeAsConfig
      ? ` It expects one config object, for example {${positions[0].fields.map(field => `"${field}":…`).join(', ')}}.`
      : '';
    throw new Error(`${exportedName} takes ${takes}, so "${args[declared]}" would be ignored.${shape}`);
  }
  parsed.forEach((argument, index) => {
    const {fields, nested} = positions[index];
    // An array is an object to `typeof`, but it carries no settings either.
    const isBareObject =
      typeof argument === 'object' && argument !== null && !Array.isArray(argument) && !isIndicatorInstance(argument);
    const expectation =
      args.length === 1
        ? `${exportedName} takes its settings in a config object`
        : `${exportedName} expects a config object in position ${index + 1}`;
    if (fields.length > 0 && !isBareObject) {
      throw new Error(
        `${expectation}, so "${args[index]}" would leave those defaults in place. Pass JSON instead, for example {${fields.map(field => `"${field}":…`).join(', ')}}.`
      );
    }
    /*
     * A number consumed by assignment leaves no trace, so an unread position is only suspicious for
     * a value that could not be one: a bare object. Excess arguments are caught by their count.
     */
    if (fields.length === 0 && isBareObject) {
      throw new Error(
        `${exportedName} never reads the argument in position ${index + 1}, so "${args[index]}" is lost.`
      );
    }
    /*
     * The keys are checked against the ones the constructor reached for, because a misspelled
     * setting is dropped by the destructuring and leaves its default in place: an indicator asked
     * for "intervall" would report a reading for the interval it was never given.
     */
    if (fields.length > 0 && argument !== null && typeof argument === 'object') {
      assertKeysAreRead(exportedName, argument, fields);
      for (const [key, nestedFields] of nested) {
        const value: unknown = Reflect.get(argument, key);
        if (nestedFields.length > 0 && value !== null && typeof value === 'object') {
          assertKeysAreRead(`${exportedName}'s "${key}"`, value, nestedFields);
        }
      }
    }
  });

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
