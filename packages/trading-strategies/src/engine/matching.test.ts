import {describe, expect, it} from 'vitest';
import {refuseShadowedRules} from './matching.js';
import type {CloseRule, OpenRule} from './types.js';

type Facts = {close: number};

const always: CloseRule<Facts> = {because: 'always', when: 'always'};
const conditional: CloseRule<Facts> = {because: 'conditional', when: ({close}) => close > 100};
const noOpenRules: readonly OpenRule<Facts>[] = [];

describe('refuseShadowedRules', () => {
  it('refuses a rule that nothing below it can ever answer', () => {
    expect(
      () =>
        refuseShadowedRules({
          closeRules: [always, conditional],
          interval: undefined,
          name: 'shadowed',
          openRules: noOpenRules,
        }),
      'a rule judged on every candle always matches, so the rule under it is dead code'
    ).toThrow(/shadows/);
  });

  it('allows one as the last word in its slot', () => {
    expect(() =>
      refuseShadowedRules({
        closeRules: [conditional, always],
        interval: undefined,
        name: 'fallback',
        openRules: noOpenRules,
      })
    ).not.toThrow();
  });

  it('allows one that waits for a larger bar than the rules under it', () => {
    expect(
      () =>
        refuseShadowedRules({
          closeRules: [{...always, timeframe: '1h'}, conditional],
          interval: undefined,
          name: 'hourly first',
          openRules: noOpenRules,
        }),
      'it is skipped while its hour is still open, which is when the rule under it gets its turn'
    ).not.toThrow();
  });

  it('allows one that inherits a larger bar from the strategy', () => {
    expect(
      () =>
        refuseShadowedRules({
          closeRules: [always, conditional],
          interval: '1h',
          name: 'hourly strategy',
          openRules: noOpenRules,
        }),
      'what a rule is judged on is its own timeframe or, failing that, the strategy interval'
    ).not.toThrow();
  });

  it('refuses one written as every-candle inside a larger-interval strategy', () => {
    expect(() =>
      refuseShadowedRules({
        closeRules: [{...always, timeframe: '1m'}, conditional],
        interval: '1h',
        name: 'minute first',
        openRules: noOpenRules,
      })
    ).toThrow(/shadows/);
  });

  it('judges each slot on its own', () => {
    expect(
      () =>
        refuseShadowedRules({
          closeRules: [conditional],
          interval: undefined,
          name: 'both slots',
          openRules: [
            {because: 'open', spend: 'all', when: 'always'},
            {because: 'later', spend: 'all', when: 'always'},
          ],
        }),
      'a shadowed rule in one slot is not excused by the other slot being fine'
    ).toThrow(/shadows/);
  });
});
