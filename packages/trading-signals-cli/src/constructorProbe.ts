/**
 * Names the settings a constructor expects in a config object, or nothing when it takes positional
 * arguments.
 *
 * A constructor that destructures a parameter reads the settings off it. Handed a number instead,
 * JavaScript boxes that number, the destructuring finds none of the properties, and every default
 * applies: `new SuperTrend(14, 5)` silently runs with an interval of 10 and a multiplier of 3, and
 * `new CCI(20, 1)` with the default thresholds. So every position the constructor declares is offered a
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

export function configPositions(
  IndicatorConstructor: new (...args: unknown[]) => unknown,
  count: number
): ConfigShape[] {
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
/**
 * How many parameters the constructor that actually runs declares. A value consumed by assignment
 * leaves no trace for a probe to find, so `new SMA(5, 999)` keeps the 999 to itself; the parameter
 * list is the only place the excess shows up.
 *
 * Read from the source of the nearest class that declares a constructor, because a subclass without
 * one inherits it: SMA takes its interval from MovingAverage. An unreadable parameter list, or a
 * chain that declares none at all, yields no limit rather than a guessed one.
 */
export function declaredParameterCount(IndicatorConstructor: new (...args: unknown[]) => unknown): number {
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
export function assertKeysAreRead(subject: string, config: object, fields: readonly string[]): void {
  const unread = Object.keys(config).filter(key => !fields.includes(key));
  if (unread.length > 0) {
    throw new Error(
      `${subject} does not read ${unread.map(key => `"${key}"`).join(', ')}. It expects ${fields.map(field => `"${field}"`).join(', ')}.`
    );
  }
}
