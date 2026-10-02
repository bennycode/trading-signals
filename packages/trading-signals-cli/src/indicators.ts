import * as library from 'trading-signals';
import type {IndicatorInputShapes} from 'trading-signals';
import {ALIASES} from './aliases.js';
import {assertKeysAreRead, configPositions, declaredParameterCount} from './constructorProbe.js';

export interface Indicator {
  getRequiredInputs(): number;
  /** Which part of a candle the indicator consumes, as the library declares it. */
  inputShape?: IndicatorInputShapes;
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
for (const [alias, name] of Object.entries(ALIASES)) {
  const value = INDICATORS.get(name);
  if (value) {
    BY_LOWERCASE_NAME.set(alias.toLowerCase(), {name, value});
  }
}
const ALIASES_BY_NAME = new Map(Object.entries(ALIASES).map(([alias, name]) => [name, alias.toLowerCase()]));

/**
 * Indicator names in alphabetical order, optionally narrowed by a substring. Sorted explicitly
 * rather than left to the order the exports are enumerated in: a module namespace hands them over
 * sorted, but a bundler's stand-in for one keeps the order they were declared in, and the command
 * should not print a different list depending on how its input was loaded.
 */
export function listIndicators(query = ''): string[] {
  const needle = query.toLowerCase();
  return Array.from(INDICATORS.keys())
    .filter(name => name.toLowerCase().includes(needle) || ALIASES_BY_NAME.get(name)?.includes(needle))
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

/** An indicator instance passes as an argument (MACD takes three); a bare config object does not. */
function isIndicatorInstance(value: object): boolean {
  return typeof Reflect.get(value, 'update') === 'function';
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

  const declared = declaredParameterCount(IndicatorConstructor);
  // Every declared position is probed, so a config the caller left out can be named too.
  const positions = configPositions(IndicatorConstructor, Number.isFinite(declared) ? declared : parsed.length);
  const settingsComeAsConfig = (positions[0]?.fields.length ?? 0) > 0;

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
        if (nestedFields.length === 0 || !(key in argument)) {
          continue;
        }
        const value: unknown = Reflect.get(argument, key);
        // A setting of its own that is handed a number is boxed and ignored, exactly like a whole config would be.
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error(
            `${exportedName}'s "${key}" takes its settings in a config object, so "${JSON.stringify(value)}" would leave those defaults in place. It expects ${nestedFields.map(field => `"${field}"`).join(', ')}.`
          );
        }
        assertKeysAreRead(`${exportedName}'s "${key}"`, value, nestedFields);
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
    /*
     * A config the caller left out arrives as undefined, and the constructor fails reading a setting
     * off it. The language's message names the setting but not the remedy, so the expected shape is
     * offered instead.
     */
    const missing = positions.slice(parsed.length).find(({fields}) => fields.length > 0);
    if (error instanceof TypeError && missing) {
      throw new Error(
        `${describe}: it needs a config object, for example {${missing.fields.map(field => `"${field}":…`).join(', ')}}.`
      );
    }
    throw new Error(`${describe}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!Number.isInteger(required) || required < 1) {
    throw new Error(
      `${describe}: they leave it needing "${required}" inputs. Check the arguments this indicator expects, such as an interval ("sma 20") or a config ("psar {\\"accelerationStep\\":0.02}").`
    );
  }
  return {create, name: exportedName};
}
