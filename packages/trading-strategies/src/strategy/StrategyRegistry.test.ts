import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import * as strategies from '../index.js';
import {createStrategy, getStrategyNames} from './StrategyRegistry.js';

/** The strategies that have nothing sensible to default to and say so in their schema. */
const requiredConfig: Record<string, unknown> = {
  '@typedtrader/strategy-buy-below-sell-above': {buyBelow: '90'},
  '@typedtrader/strategy-multi-indicator-confluence': {
    bollingerDeviationMultiplier: 2,
    bollingerPeriod: 20,
    emaLongPeriod: 21,
    emaShortPeriod: 9,
    macdLongPeriod: 26,
    macdShortPeriod: 12,
    macdSignalPeriod: 9,
    rsiOverbought: 70,
    rsiOversold: 30,
    rsiPeriod: 14,
  },
};

describe('StrategyRegistry', () => {
  it('builds every registered strategy from what a user may leave unset', () => {
    for (const name of getStrategyNames()) {
      expect(
        () => createStrategy(name, requiredConfig[name]),
        `${name} has to be startable from its own defaults`
      ).not.toThrow();
    }
  });

  it('names a strategy that does not exist instead of failing silently', () => {
    expect(() => createStrategy('@typedtrader/strategy-nope', {})).toThrow(/Unknown strategy/);
  });

  it('refuses a stored config that says where one kill switch goes in two units', () => {
    expect(
      () => createStrategy('@typedtrader/strategy-buy-once', {stopLossNominal: '50', stopLossPct: '5'}),
      'a contradiction in a stored config is rejected rather than resolved'
    ).toThrow();
  });

  it('exports settings the config UI can render as JSON Schema', () => {
    let checked = 0;

    for (const [name, exported] of Object.entries(strategies)) {
      if (!(exported instanceof z.ZodType)) {
        continue;
      }
      checked += 1;
      expect(
        () => z.toJSONSchema(exported),
        `${name} has to survive the JSON Schema the config reference renders from`
      ).not.toThrow();
    }

    expect(checked, 'the strategies export the schemas the docs site reads').toBeGreaterThan(0);
  });
});
