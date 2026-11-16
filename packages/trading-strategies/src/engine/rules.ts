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

/**
 * The thresholds {@link stopLoss} and {@link takeProfit} read when a strategy offers them as
 * config. A strategy extends this schema and then lists the rules it wants, so the settings a
 * user sees and the rules that act on them cannot drift apart.
 */
export const ProtectionSchema = z.object({
  /** Sell everything and stop when the position is this many percent down. Omit to run unprotected. */
  stopLossPct: positiveNumberString.optional(),
  /** Sell everything and stop when the position is this many percent up. Omit to run unprotected. */
  takeProfitPct: positiveNumberString.optional(),
});

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

/** A percentage written on a rule, or read from the strategy's own config at evaluation time. */
export type Percentage<Config> = BigSource | ((facts: ProtectionFacts<Config>) => BigSource | undefined);

export interface TrailingStopOptions<Config> extends ProtectionOptions<Config> {
  /**
   * A price the trail refuses to anchor below. Without it the anchor starts at the first high the
   * engine sees, which for a position opened elsewhere is whatever candle it attached on rather
   * than a price that means anything.
   */
  pivot?: (facts: ProtectionFacts<Config>) => BigSource | undefined;
}

/** The order type a protective rule places, or read from config at evaluation time. */
export type OrderKind<Config> = 'limit' | 'market' | ((facts: ProtectionFacts<Config>) => 'limit' | 'market');

export interface ProtectionOptions<Config> {
  pct: Percentage<Config>;
  /**
   * `'market'` (the default) guarantees the exit fills at whatever the market offers. `'limit'`
   * offers exactly the threshold price instead, which is predictable but can miss a gap.
   */
  as?: OrderKind<Config>;
}

function resolve<Config>(percentage: Percentage<Config>, facts: ProtectionFacts<Config>): Big | undefined {
  const value = typeof percentage === 'function' ? percentage(facts) : percentage;
  return value === undefined ? undefined : new Big(value);
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
 * Sells the position once it is down `pct` percent from its entry price, and stops the strategy:
 * the engine re-places the exit until the position is gone and never opens again, because a stop
 * firing means the reason for holding was wrong.
 *
 * Checked on every candle rather than on the strategy's `interval`, because a stop that waits for
 * an hourly bar is not a stop.
 *
 * Contributes no rule at all while `pct` resolves to `undefined`, so a strategy can expose the
 * threshold as optional config and run unprotected when it is unset.
 */
export function stopLoss<Config>(options: ProtectionOptions<Config>): CloseRule<ProtectionFacts<Config>> {
  const threshold = (facts: ProtectionFacts<Config>): Big | undefined => {
    const pct = resolve(options.pct, facts);
    if (pct === undefined || !facts.position) {
      return undefined;
    }
    return facts.position.entryPrice.mul(new Big(1).minus(pct.div(100)));
  };

  return {
    because: facts =>
      `Stop-loss: ${facts.position?.unrealizedPct.toFixed(2) ?? '0'}% <= -${resolve(options.pct, facts)?.toFixed(2) ?? '0'}%`,
    limit: priceFor(options, threshold),
    then: 'finish',
    timeframe: '1m',
    when: facts => {
      const pct = resolve(options.pct, facts);
      if (pct === undefined || !facts.position) {
        return false;
      }
      return facts.position.unrealizedPct.lte(pct.neg());
    },
  };
}

/** Sells the position once it is up `pct` percent from its entry price. Stops the strategy, like {@link stopLoss}. */
export function takeProfit<Config>(options: ProtectionOptions<Config>): CloseRule<ProtectionFacts<Config>> {
  const threshold = (facts: ProtectionFacts<Config>): Big | undefined => {
    const pct = resolve(options.pct, facts);
    if (pct === undefined || !facts.position) {
      return undefined;
    }
    return facts.position.entryPrice.mul(new Big(1).plus(pct.div(100)));
  };

  return {
    because: facts =>
      `Take-profit: ${facts.position?.unrealizedPct.toFixed(2) ?? '0'}% >= +${resolve(options.pct, facts)?.toFixed(2) ?? '0'}%`,
    limit: priceFor(options, threshold),
    then: 'finish',
    timeframe: '1m',
    when: facts => {
      const pct = resolve(options.pct, facts);
      if (pct === undefined || !facts.position) {
        return false;
      }
      return facts.position.unrealizedPct.gte(pct);
    },
  };
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
