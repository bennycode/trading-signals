import {describe, expect, it} from 'vitest';
import {formatScore, unreadWeight, type Criterion} from './ScoreCard.js';

function criterion(overrides: Partial<Criterion>): Criterion {
  return {category: 'trend', fired: false, measures: [], name: 'test', question: 'Is it?', weight: 10, ...overrides};
}

describe('formatScore', () => {
  it('keeps a rank and a ratio from reading like the same number', () => {
    expect(
      formatScore({kind: 'ratio', outOf: 100, value: 25}),
      '25 of 100 is a chart with the evidence against it'
    ).toBe('25/100');
    expect(
      formatScore({kind: 'rank', outOf: 503, value: 25}),
      'the same 25 as a rank is one of the strongest names in the field'
    ).toBe('#25 of 503');
  });
});

describe('unreadWeight', () => {
  it('counts the fields that had nothing to read, not the ones that answered no', () => {
    const weight = unreadWeight([
      criterion({fired: null, weight: 15}),
      criterion({fired: false, weight: 23}),
      criterion({fired: true, weight: 17}),
    ]);

    expect(weight, 'an unread field moves the score by nothing, so it flatters it by its own weight').toBe(15);
  });

  it('is zero once every field has been read', () => {
    expect(unreadWeight([criterion({fired: true}), criterion({fired: false})])).toBe(0);
  });
});
