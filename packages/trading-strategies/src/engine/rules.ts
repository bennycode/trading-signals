import Big from 'big.js';
import type {BigSource} from 'big.js';
import type {StringValue} from 'ms';
import type {OneMinuteBatchedCandle} from '@typedtrader/exchange';
import type {TechnicalIndicator} from 'trading-signals';
import {BatchedIndicator} from '../util/BatchedIndicator.js';
import {percentTrailStop} from '../util/trailStop.js';
import type {CloseRule, IndicatorDeclaration, PositionFacts} from './types.js';

/**
 * Declares an indicator on a timeframe. The engine creates it from the parsed config, rolls the
 * session's one-minute candles up to `interval`, and exposes its result to rules under the name
 * it was declared with. Rules never see the indicator itself, only its latest result.
 */
export function every<Result, Config>(
  interval: StringValue,
  create: (config: Config) => TechnicalIndicator<Result, number>
): IndicatorDeclaration<Result, Config> {
  return {
    create: config => new BatchedIndicator(interval, create(config), bar => bar.close.toNumber()),
  };
}

/** The facts a protective rule reads. Declaring it separately keeps these helpers strategy-agnostic. */
export interface ProtectionFacts<Config> {
  candle: OneMinuteBatchedCandle;
  config: Config;
  position: PositionFacts | null;
}

/** A percentage written on a rule, or read from the strategy's own config at evaluation time. */
export type Percentage<Config> = BigSource | ((facts: ProtectionFacts<Config>) => BigSource | undefined);

export interface ProtectionOptions<Config> {
  pct: Percentage<Config>;
  /**
   * `'market'` (the default) guarantees the exit fills at whatever the market offers. `'limit'`
   * offers exactly the threshold price instead, which is predictable but can miss a gap.
   */
  as?: 'limit' | 'market';
}

function resolve<Config>(percentage: Percentage<Config>, facts: ProtectionFacts<Config>): Big | undefined {
  const value = typeof percentage === 'function' ? percentage(facts) : percentage;
  return value === undefined ? undefined : new Big(value);
}

/**
 * A protective rule only reaches `at` once its `when` matched, so the inputs it needs are present
 * by then. Throwing rather than returning a fallback price keeps a real bug from being placed as
 * an order.
 */
function required(price: Big | undefined): Big {
  if (price === undefined) {
    throw new Error('A protective limit price needs an open position and a configured percentage');
  }
  return price;
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
    at: options.as === 'limit' ? facts => required(threshold(facts)) : undefined,
    because: facts =>
      `Stop-loss: ${facts.position?.unrealizedPct.toFixed(2) ?? '0'}% <= -${resolve(options.pct, facts)?.toFixed(2) ?? '0'}%`,
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
    at: options.as === 'limit' ? facts => required(threshold(facts)) : undefined,
    because: facts =>
      `Take-profit: ${facts.position?.unrealizedPct.toFixed(2) ?? '0'}% >= +${resolve(options.pct, facts)?.toFixed(2) ?? '0'}%`,
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
export function trailingStop<Config>(options: ProtectionOptions<Config>): CloseRule<ProtectionFacts<Config>> {
  const threshold = (facts: ProtectionFacts<Config>): Big | undefined => {
    const pct = resolve(options.pct, facts);
    if (pct === undefined || !facts.position) {
      return undefined;
    }
    return percentTrailStop(facts.position.bestPrice, pct);
  };

  return {
    at: options.as === 'limit' ? facts => required(threshold(facts)) : undefined,
    because: facts =>
      `Trailing stop: close ${facts.candle.close.toFixed()} <= ${threshold(facts)?.toFixed() ?? '0'} (best ${facts.position?.bestPrice.toFixed() ?? '0'})`,
    then: 'finish',
    timeframe: '1m',
    when: facts => {
      const stop = threshold(facts);
      return stop !== undefined && facts.candle.close.lte(stop);
    },
  };
}
