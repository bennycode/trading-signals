import {describe, expect, it} from 'vitest';
import {unreadWeight} from '@typedtrader/scorecard';
import type {Candle} from '@typedtrader/exchange';
import {ChartHealth} from './ChartHealth.js';
import {OPPORTUNITY_FIELDS, RETURN_NOISE_IN_PERCENT, type OpportunityFieldName} from './chartOpportunity.js';

const DAY_IN_MILLIS = 86_400_000;
const STEADY_VOLUME = 1_000_000;

function dailyCandles(closes: readonly number[], volumeOf: (falling: boolean) => number = () => STEADY_VOLUME) {
  return closes.map((close, index): Candle => {
    const previous = closes[index - 1] ?? close;

    return {
      base: 'AAPL',
      close: String(close),
      counter: 'USD',
      high: String(Math.max(close, previous) + 0.75),
      low: String(Math.min(close, previous) - 0.75),
      open: String(previous),
      openTimeInISO: new Date(index * DAY_IN_MILLIS).toISOString(),
      openTimeInMillis: index * DAY_IN_MILLIS,
      sizeInMillis: DAY_IN_MILLIS,
      volume: String(volumeOf(close < previous)),
    };
  });
}

function cardFor(series: readonly Candle[], benchmark?: readonly Candle[]) {
  const chart = new ChartHealth();

  series.forEach((candle, index) => chart.add(candle, benchmark?.[index]));

  const card = chart.getOpportunityCard();

  if (card === null) {
    throw new Error('the series is too short to read a card from');
  }

  return card;
}

const firedNames = (names: readonly {fired: boolean | null; name: OpportunityFieldName}[]) =>
  names.filter(field => field.fired === true).map(field => field.name);

const rising = Array.from({length: 280}, (_, index) => 100 + index * 0.8);
const falling = [...rising].reverse();

describe('ChartHealth opportunity card', () => {
  it('splits the market fall from the instrument fall, which is the question it exists for', () => {
    const withTheMarket = cardFor(dailyCandles(falling), dailyCandles(falling));
    const onItsOwn = cardFor(dailyCandles(falling), dailyCandles(rising));

    expect(
      firedNames(withTheMarket.criteria),
      'a fall of any depth matched by the benchmark gave up no ground'
    ).toContain('fellWithMarket');
    expect(
      firedNames(onItsOwn.criteria),
      'the same fall against a market that rose is the instrument own doing'
    ).not.toContain('fellWithMarket');
    expect(withTheMarket.score.value).toBeGreaterThan(onItsOwn.score.value);
  });

  it('does not split hairs over a name that fell within a point of its market', () => {
    const market = [...rising].reverse();
    /*
     * A hair behind the market the whole way, which no reader comparing the two charts would call
     * falling on its own.
     */
    const justBehind = market.map((close, index) => close - index * 0.002);
    const card = cardFor(dailyCandles(justBehind), dailyCandles(market));
    const excess = card.criteria
      .find(field => field.name === 'fellWithMarket')
      ?.measures.find(entry => entry.label === 'excess return vs noise floor')?.reading;

    expect(excess).toBeLessThan(0);
    expect(excess).toBeGreaterThan(-RETURN_NOISE_IN_PERCENT);
    expect(
      card.criteria.find(field => field.name === 'fellWithMarket')?.fired,
      'a knife edge at exactly zero would answer this the same way as a fall nobody else took'
    ).toBe(true);
  });

  it('refuses to call a name that held flat through a falling market a dip', () => {
    const market = falling;
    /*
     * Moderna in November 2026: down a single point while the index gave up seven, which is what
     * moved it up the momentum ranking rather than into the bargain bin.
     */
    const heldFlat = Array.from({length: market.length}, (_, index) => 200 - index * 0.004);
    const card = cardFor(dailyCandles(heldFlat), dailyCandles(market));

    expect(card.returnPercent).toBeLessThan(0);
    expect(card.returnPercent).toBeGreaterThan(-RETURN_NOISE_IN_PERCENT);
    expect(
      firedNames(card.criteria),
      'a question about whose fall it was cannot be answered by a name that did not fall'
    ).not.toContain('fellWithMarket');
    expect(card.verdict, 'holding flat through a market that fell is strength, not a dip').toBe('noDip');
  });

  it('refuses to call a rising instrument a dip, however well it reads otherwise', () => {
    const card = cardFor(dailyCandles(rising), dailyCandles(rising));

    expect(card.returnPercent).toBeGreaterThan(0);
    expect(card.verdict, 'an instrument that did not fall has no dip to buy, whatever else is true of it').toBe(
      'noDip'
    );
  });

  it('adds for a field rather than deducting, which is what makes it the other side of the health card', () => {
    const card = cardFor(dailyCandles(falling), dailyCandles(falling));

    expect(card.firedMeans, 'a reader cannot mark a row without knowing which way its yes points').toBe('strength');
    expect(card.score.outOf).toBe(100);
    expect(
      OPPORTUNITY_FIELDS.reduce((sum, field) => sum + field.weight, 0),
      'the fields are a closed budget, so a score is comparable between two instruments'
    ).toBe(100);
  });

  it('leaves the field that needs a second series unread, and says so in the weight', () => {
    const card = cardFor(dailyCandles(falling));
    const market = card.criteria.find(field => field.name === 'fellWithMarket');

    expect(market?.fired, 'with no benchmark there is nothing to answer the question against').toBeNull();
    expect(
      unreadWeight(card.criteria),
      'the premise of buying a dip is the heaviest field, so a card without it is the one worth distrusting'
    ).toBe(35);
  });

  it('reads a fall on widening ranges as a breakdown rather than a stretch', () => {
    const panicking = falling.map((close, index) => close - index * 0.35);
    const card = cardFor(dailyCandles(panicking), dailyCandles(rising));

    expect(firedNames(card.criteria)).not.toContain('orderlyRanges');
    expect(card.verdict).toBe('breakdown');
  });

  it('holds the volume tilt against a fall the sellers drove', () => {
    const heavyOnTheWayDown = cardFor(
      dailyCandles(falling, down => (down ? 5_000_000 : 800_000)),
      dailyCandles(falling)
    );

    expect(
      firedNames(heavyOnTheWayDown.criteria),
      'weight on the down bars is sellers in control, whatever the benchmark did'
    ).not.toContain('noDistribution');
  });
});
