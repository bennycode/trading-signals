import Big from 'big.js';
import type {BigSource} from 'big.js';
import type {StringValue} from 'ms';
import {z} from 'zod';
import type {Candle, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {TechnicalIndicator} from 'trading-signals';
import {BatchedIndicator} from '../util/BatchedIndicator.js';
import {percentTrailStop} from '../util/trailStop.js';
import {positiveNumberString} from '../util/validators.js';
import type {CloseRule, IndicatorDeclaration, PositionFacts} from './types.js';

/**
 * Declares an indicator on a timeframe. The engine creates it from the parsed config, rolls the
 * session's one-minute candles up to `interval`, and exposes its result to rules under the name
 * it was declared with. Rules never see the indicator itself, only its latest result.
 */
export function every<Result, Config>(
  interval: StringValue | ((config: Config) => StringValue),
  create: (config: Config) => TechnicalIndicator<Result, number>
): IndicatorDeclaration<Result, Config> {
  return {
    create: config =>
      new BatchedIndicator(typeof interval === 'function' ? interval(config) : interval, create(config), bar =>
        bar.close.toNumber()
      ),
  };
}

/**
 * Declares something derived once from past bars, which rules then read by name like an indicator
 * result. It is what a strategy needs when a setting is supposed to come from the market rather
 * than from the user: a sensible offset, a gate on whether the instrument suits the strategy at
 * all. The engine fetches `count` bars of `interval` from the broker before the session starts.
 *
 * Returning `undefined` means "could not decide", and because facts reach rules through getters
 * that throw on an absent result, every rule reading it simply does not fire. A strategy that
 * must not trade without a derived setting therefore needs no guard of its own.
 */
export function fromHistory<Result, Config>(
  count: number,
  interval: StringValue,
  compute: (candles: Candle[], config: Config) => Result | undefined
): IndicatorDeclaration<Result, Config> {
  return {
    create: config => {
      let result: Result | undefined;
      let decided = false;
      const decide = (candles: Candle[]) => {
        result = compute(candles, config);
        decided = true;
      };

      return {
        add: () => {},
        // Deciding on no history at all keeps a value that comes from config alone available.
        getResult: () => {
          if (!decided) {
            decide([]);
          }
          return result;
        },
        warmUp: decide,
      };
    },
    history: {count, interval},
  };
}

/** The three ways of saying where one kill switch goes, of which a config may use one. */
const EXCLUSIVE_FORMS = [
  ['stopLossPct', 'stopLossNominal', 'stopLossPrice'],
  ['takeProfitPct', 'takeProfitNominal', 'takeProfitPrice'],
] as const;

/**
 * The thresholds {@link protection} reads when a strategy offers them as config. A strategy
 * extends this schema and adds that rule, so the settings a user sees and the rules that act on
 * them cannot drift apart. Every threshold is optional: a strategy whose user sets none of them
 * runs unprotected.
 */
export const ProtectionSchema = z
  .object({
    /** Sell everything and stop once the position is down this much counter currency. */
    stopLossNominal: positiveNumberString.optional(),
    /** Sell everything and stop once the position is down this many percent. */
    stopLossPct: positiveNumberString.optional(),
    /** Sell everything and stop once price reaches this, wherever the position was entered. */
    stopLossPrice: positiveNumberString.optional(),
    /** Sell everything and stop once the position is up this much counter currency. */
    takeProfitNominal: positiveNumberString.optional(),
    /** Sell everything and stop once the position is up this many percent. */
    takeProfitPct: positiveNumberString.optional(),
    /** Sell everything and stop once price reaches this, wherever the position was entered. */
    takeProfitPrice: positiveNumberString.optional(),
  })
  .check(ctx => {
    for (const forms of EXCLUSIVE_FORMS) {
      const given = forms.filter(form => ctx.value[form] !== undefined);
      if (given.length > 1) {
        ctx.issues.push({
          code: 'custom',
          input: ctx.value,
          message: `${given.join(' and ')} are one exit said in different units, so set only one of them`,
        });
      }
    }
  });

export type ProtectionSettings = z.output<typeof ProtectionSchema>;

/**
 * Reads a value that a rule's `when` has already proved present, for the `at` and sizing
 * callbacks that run afterwards. Throwing rather than substituting a fallback keeps a wrong price
 * or size from reaching the broker as an order.
 */
export function required<T>(value: T | null | undefined, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`${what} is missing although the rule reading it matched`);
  }
  return value;
}

/** The facts a protective rule reads. Declaring it separately keeps these helpers strategy-agnostic. */
export interface ProtectionFacts<Config> {
  candle: OneMinuteBatchedCandle;
  config: Config;
  position: PositionFacts | null;
}

/** A threshold written on a rule, or read from the strategy's own config at evaluation time. */
export type Threshold<Config> = BigSource | ((facts: ProtectionFacts<Config>) => BigSource | undefined);

export interface TrailingStopOptions<Config> extends ProtectionOptions<Config> {
  pct: Threshold<Config>;
  /**
   * A price the trail refuses to anchor below. Without it the anchor starts at the first high the
   * engine sees, which for a position opened elsewhere is whatever candle it attached on rather
   * than a price that means anything.
   */
  pivot?: (facts: ProtectionFacts<Config>) => BigSource | undefined;
}

/** The order type a protective rule places, or read from config at evaluation time. */
export type OrderKind<Config> = 'limit' | 'market' | ((facts: ProtectionFacts<Config>) => 'limit' | 'market');

/**
 * Where a kill switch fires, which can be said in three equivalent units: away from the entry
 * price in percent, away from it in counter currency, or as the price itself. A rule given more
 * than one resolves the least derived first, and {@link ProtectionSchema} refuses a config that
 * sets more than one so a user never relies on that order.
 */
export interface ProtectionOptions<Config> {
  /**
   * `'market'` (the default) guarantees the exit fills at whatever the market offers. `'limit'`
   * offers exactly the threshold price instead, which is predictable but can miss a gap.
   */
  as?: OrderKind<Config>;
  nominal?: Threshold<Config>;
  pct?: Threshold<Config>;
  price?: Threshold<Config>;
}

function resolve<Config>(threshold: Threshold<Config> | undefined, facts: ProtectionFacts<Config>): Big | undefined {
  const value = typeof threshold === 'function' ? threshold(facts) : threshold;
  return value === undefined ? undefined : new Big(value);
}

/**
 * The price the position has to reach for a kill switch to fire. All three forms come back as a
 * price, which is also what the rule offers as its limit, so the exit goes at the threshold the
 * user named rather than wherever the market has moved by the time it trips.
 *
 * `sign` points away from the entry price in the direction the switch watches.
 */
function thresholdPrice<Config>(
  options: ProtectionOptions<Config>,
  sign: 1 | -1
): (facts: ProtectionFacts<Config>) => Big | undefined {
  return facts => {
    const price = resolve(options.price, facts);
    if (price !== undefined) {
      return price;
    }
    const {position} = facts;
    if (!position || position.size.lte(0)) {
      return undefined;
    }
    const nominal = resolve(options.nominal, facts);
    if (nominal !== undefined) {
      return position.entryPrice.plus(nominal.div(position.size).mul(sign));
    }
    const pct = resolve(options.pct, facts);
    return pct === undefined ? undefined : position.entryPrice.mul(new Big(1).plus(pct.div(100).mul(sign)));
  };
}

/**
 * Turns a threshold into the rule's limit price, or into `undefined` when the exit is to go at
 * market. Deciding it per evaluation rather than when the rule is built is what lets a strategy
 * offer the order type as a setting.
 */
function priceFor<Config>(
  options: ProtectionOptions<Config>,
  threshold: (facts: ProtectionFacts<Config>) => Big | undefined
): (facts: ProtectionFacts<Config>) => Big | undefined {
  return facts => {
    const kind = typeof options.as === 'function' ? options.as(facts) : options.as;
    return kind === 'limit' ? threshold(facts) : undefined;
  };
}

/**
 * One kill switch: an exit that fires when price reaches the threshold and then ends the
 * strategy. The engine re-places it until the position is gone and never opens again, because a
 * switch firing means the reason for holding was wrong.
 *
 * Judged on every candle rather than on the strategy's `interval`, because a stop that waits for
 * an hourly bar is not a stop.
 */
function killSwitch<Config>(
  label: string,
  sign: 1 | -1,
  options: ProtectionOptions<Config>
): CloseRule<ProtectionFacts<Config>> {
  const threshold = thresholdPrice(options, sign);
  const comparison = sign < 0 ? '<=' : '>=';

  return {
    because: facts => {
      const move = facts.position ? ` (${facts.position.unrealizedPct.toFixed(2)}%)` : '';
      return `${label}: close ${facts.candle.close.toFixed()}${move} ${comparison} ${threshold(facts)?.toFixed() ?? '?'}`;
    },
    limit: priceFor(options, threshold),
    then: 'finish',
    timeframe: '1m',
    when: facts => {
      const target = threshold(facts);
      if (target === undefined) {
        return false;
      }
      return sign < 0 ? facts.candle.close.lte(target) : facts.candle.close.gte(target);
    },
  };
}

/**
 * Sells the position and stops the strategy once price has fallen to the threshold.
 *
 * Contributes a rule that never fires while every threshold resolves to `undefined`, so a
 * strategy can expose them as optional config and run unprotected when none is set.
 */
export function stopLoss<Config>(options: ProtectionOptions<Config>): CloseRule<ProtectionFacts<Config>> {
  return killSwitch('Stop-loss', -1, options);
}

/** Sells the position and stops the strategy once price has risen to the threshold. */
export function takeProfit<Config>(options: ProtectionOptions<Config>): CloseRule<ProtectionFacts<Config>> {
  return killSwitch('Take-profit', 1, options);
}

/**
 * Both kill switches, wired to the settings of {@link ProtectionSchema}. A strategy extending
 * that schema adds this one rule instead of repeating the wiring, which is what keeps every
 * strategy's protection settings meaning the same thing.
 */
export function protection<Config extends ProtectionSettings>(): CloseRule<ProtectionFacts<Config>>[] {
  return [
    stopLoss<Config>({
      nominal: ({config}) => config.stopLossNominal,
      pct: ({config}) => config.stopLossPct,
      price: ({config}) => config.stopLossPrice,
    }),
    takeProfit<Config>({
      nominal: ({config}) => config.takeProfitNominal,
      pct: ({config}) => config.takeProfitPct,
      price: ({config}) => config.takeProfitPrice,
    }),
  ];
}

/**
 * Sells the position once price falls `pct` percent from the best price seen since it opened. The
 * anchor only ever moves in the position's favour, so the threshold never loosens. Stops the
 * strategy, like {@link stopLoss}.
 */
export function trailingStop<Config>(options: TrailingStopOptions<Config>): CloseRule<ProtectionFacts<Config>> {
  const anchor = (facts: ProtectionFacts<Config>): Big | undefined => {
    if (!facts.position) {
      return undefined;
    }
    const pivot = options.pivot?.(facts);
    const floor = pivot === undefined ? undefined : new Big(pivot);
    return floor?.gt(facts.position.bestPrice) ? floor : facts.position.bestPrice;
  };

  const threshold = (facts: ProtectionFacts<Config>): Big | undefined => {
    const pct = resolve(options.pct, facts);
    const from = anchor(facts);
    if (pct === undefined || from === undefined) {
      return undefined;
    }
    return percentTrailStop(from, pct);
  };

  return {
    because: facts =>
      `Trailing stop: close ${facts.candle.close.toFixed()} <= ${threshold(facts)?.toFixed() ?? '0'} (best ${anchor(facts)?.toFixed() ?? '0'})`,
    limit: priceFor(options, threshold),
    then: 'finish',
    timeframe: '1m',
    when: facts => {
      const stop = threshold(facts);
      return stop !== undefined && facts.candle.close.lte(stop);
    },
  };
}
