import {IndicatorNotReady} from './IndicatorNotReady.js';
import {ONE_MINUTE_IN_MS} from '@typedtrader/exchange';
import {ms, type StringValue} from 'ms';
import type {BatchedCandle} from '@typedtrader/exchange';
import type {OrderAdvice} from '../trader/index.js';
import type {CloseRule, Crossing, OpenRule} from './types.js';

/** A `when` that is an object is a crossing, which is judged against the previous evaluation. */
export function isCrossing<F>(when: OpenRule<F>['when']): when is Crossing<F> {
  return typeof when === 'object';
}

/** A rule identified by where it sits, which is fixed once the strategy is defined. */
export function keyOf(slot: 'close' | 'open', index: number): string {
  return `${slot}:${index}`;
}

/** A rule waiting on an indicator that has no result yet simply does not match. */
export function matches<F>(rule: OpenRule<F> | CloseRule<F>, facts: F, turnedTrue: boolean): boolean {
  const {when} = rule;
  if (when === 'always') {
    return true;
  }
  // Already judged, against the previous candle, which is the whole point of a crossing.
  if (isCrossing(when)) {
    return turnedTrue;
  }

  try {
    return when(facts);
  } catch (error) {
    if (error instanceof IndicatorNotReady) {
      return false;
    }
    throw error;
  }
}

/**
 * Judges every crossing rule, in both slots, before any rule is allowed to fire. A crossing
 * compares against the last answer it gave, so a rule left unevaluated — because a rule above it
 * fired, or because the position was on the other side — would come back to a stale answer and
 * read a move that never happened.
 */
export function judgeCrossings<F>(options: {
  factsFor: (prices: BatchedCandle) => F;
  previous: Readonly<Record<string, boolean>>;
  pricesFor: (rule: OpenRule<F> | CloseRule<F>) => BatchedCandle | undefined;
  slots: readonly (readonly ['close' | 'open', readonly (OpenRule<F> | CloseRule<F>)[]])[];
}): {answers: Record<string, boolean>; changed: boolean; turnedTrue: Set<string>} {
  const {factsFor, previous, pricesFor, slots} = options;
  const turnedTrue = new Set<string>();
  const answers = {...previous};
  let changed = false;

  for (const [slot, rules] of slots) {
    for (const [index, rule] of rules.entries()) {
      const {when} = rule;
      if (!isCrossing(when)) {
        continue;
      }

      const prices = pricesFor(rule);
      // Its bar has not closed yet, so there is nothing new to compare against.
      if (!prices) {
        continue;
      }

      let now: boolean;
      try {
        now = when.becomes(factsFor(prices));
      } catch (error) {
        if (error instanceof IndicatorNotReady) {
          continue;
        }
        throw error;
      }

      const key = keyOf(slot, index);
      if (now && answers[key] === false) {
        turnedTrue.add(key);
      }
      if (answers[key] !== now) {
        answers[key] = now;
        changed = true;
      }
    }
  }

  return {answers, changed, turnedTrue};
}

/**
 * The order of the first rule that matches, which is what makes a rule list a priority list: a
 * protective rule at the top wins over everything under it.
 *
 * A rule's reason, price and size read the same facts its condition did, so an indicator that is
 * not ready is read the same way here: this rule cannot act yet and the next one gets its turn.
 * Catching that around the whole rule rather than around the condition alone is what lets a rule
 * with `when: 'always'` price its order off an indicator.
 */
export function firstMatch<F>(options: {
  crossed: Set<string>;
  factsFor: (prices: BatchedCandle) => F;
  place: (rule: OpenRule<F> | CloseRule<F>, facts: F) => OrderAdvice;
  pricesFor: (rule: OpenRule<F> | CloseRule<F>) => BatchedCandle | undefined;
  rules: readonly (OpenRule<F> | CloseRule<F>)[];
  slot: 'close' | 'open';
}): OrderAdvice | void {
  const {crossed, factsFor, place, pricesFor, rules, slot} = options;

  for (const [index, rule] of rules.entries()) {
    const prices = pricesFor(rule);
    // Its bar has not closed yet, so this rule has nothing new to judge.
    if (!prices) {
      continue;
    }

    const facts = factsFor(prices);
    if (!matches(rule, facts, crossed.has(keyOf(slot, index)))) {
      continue;
    }

    try {
      return place(rule, facts);
    } catch (error) {
      if (error instanceof IndicatorNotReady) {
        continue;
      }
      throw error;
    }
  }
}

/**
 * Refuses a rule list whose `when: 'always'` rule can never be reached. Such a rule matches every
 * evaluation, so anything below it in the same slot is dead — except where the engine picks the
 * slot by the balance, which is why a strategy with both slots filled is left alone.
 */
export function refuseShadowedRules<F>(options: {
  closeRules: readonly CloseRule<F>[];
  hasOpenSlot: boolean;
  name: string;
  openRules: readonly OpenRule<F>[];
}): void {
  const {closeRules, hasOpenSlot, name, openRules} = options;
  const alwaysIndex = [...openRules, ...closeRules].findIndex(rule => rule.when === 'always');
  const bothSlotsFilled = openRules.length > 0 && closeRules.length > 0;

  if (alwaysIndex === -1 || bothSlotsFilled) {
    return;
  }

  const list = hasOpenSlot ? openRules : closeRules;
  if (alwaysIndex < list.length - 1) {
    throw new Error(`${name}: rule with when: 'always' shadows the rule below it`);
  }
}

/**
 * The bar size a rule is judged on: its own `timeframe` wins over the strategy's `interval`. A
 * minute is the size of the candles a strategy receives, so it needs no batching at all and
 * resolves to `undefined`, meaning "judge every candle".
 */
export function timeframeOf<F>(
  rule: OpenRule<F> | CloseRule<F>,
  interval: StringValue | undefined
): StringValue | undefined {
  const timeframe = rule.timeframe ?? interval;
  return timeframe === undefined || ms(timeframe) <= ONE_MINUTE_IN_MS ? undefined : timeframe;
}
