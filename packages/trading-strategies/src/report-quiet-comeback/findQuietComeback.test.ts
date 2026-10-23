import {findQuietComeback, rankQuietComebacks, type QuietComebackParams} from './findQuietComeback.js';

const config: QuietComebackParams = {
  grindWindow: 6,
  lookbackDays: 150,
  maxGapToLevel: 0.04,
  minDrawdown: 0.08,
  minQuietDays: 60,
  minUpDays: 4,
};

/** Linear ramp from `from` to `to` over `steps` closes, excluding `from`. */
function ramp(from: number, to: number, steps: number): number[] {
  return Array.from({length: steps}, (_, index) => from + ((to - from) * (index + 1)) / steps);
}

/** A stock that peaked at 100, fell to 80 over 100 days, and has climbed back to 97. */
function quietComeback({peak = 100, bottom = 80, recovery = 97, riseDays = 45} = {}): number[] {
  return [...Array<number>(10).fill(90), peak, ...ramp(peak, bottom, 100), ...ramp(bottom, recovery, riseDays)];
}

describe('findQuietComeback', () => {
  it('finds a stock that went quiet below a high and is climbing back toward it', () => {
    const found = findQuietComeback('TEST', quietComeback(), config);

    expect(found, 'the canonical shape must qualify').toBeDefined();
    expect(found?.level, 'the level is the highest close in the lookback window').toBe(100);
    expect(found?.quietDays, 'days since the stock last closed at the level').toBe(145);
    expect(found?.drawdown, 'the fall from the level to the lowest close since, as a negative').toBeCloseTo(-0.2, 10);
    expect(found?.gapToLevel, 'still 3% below the level, so it has not crossed yet').toBeCloseTo(-0.03, 10);
    expect(found?.riseDays, 'days elapsed since the lowest close').toBe(45);
    expect(found?.gainPerDay, 'share of the climb off the low earned per day').toBeCloseTo(0.2125 / 45, 10);
  });

  it('rejects a stock that has already crossed its level, because the move is then over', () => {
    const crossed = findQuietComeback('TEST', quietComeback({recovery: 101}), config);

    expect(crossed, 'a stock at or above the level is past the entry this report looks for').toBeUndefined();
  });

  it('rejects a stock still far below its level', () => {
    const distant = findQuietComeback('TEST', quietComeback({recovery: 90}), config);

    expect(distant, '10% below the level exceeds maxGapToLevel').toBeUndefined();
  });

  it('rejects a high the stock never meaningfully fell away from', () => {
    const shallow = findQuietComeback('TEST', quietComeback({bottom: 95, recovery: 97}), config);

    expect(shallow, 'a 5% dip is not a high of magnitude').toBeUndefined();
  });

  it('rejects a stock that only just left its high', () => {
    // The level sits 30 closes back, short of minQuietDays.
    const closes = [...Array<number>(130).fill(90), 100, ...ramp(100, 80, 10), ...ramp(80, 97, 20)];
    const recent = findQuietComeback('TEST', closes, config);

    expect(recent, 'the stock must have been quiet for minQuietDays first').toBeUndefined();
  });

  it('rejects a stock drifting sideways rather than climbing', () => {
    const flat = [...quietComeback().slice(0, -6), 97, 96.5, 97, 96.5, 97, 96.5];
    const sideways = findQuietComeback('TEST', flat, config);

    expect(sideways, 'fewer than minUpDays rises in the grind window is not a comeback').toBeUndefined();
  });

  it('silently excludes a split that was not price-adjusted, instead of reporting it', () => {
    const adjusted = quietComeback();
    const raw = adjusted.map((close, index) => (index <= 10 ? close * 10 : close));

    expect(findQuietComeback('TEST', adjusted, config), 'the adjusted series qualifies').toBeDefined();
    expect(
      findQuietComeback('TEST', raw, config),
      'the pre-split level of 1000 puts the stock 90% below it, so maxGapToLevel drops it'
    ).toBeUndefined();
  });
});

describe('rankQuietComebacks', () => {
  const candidate = (symbol: string, gainPerDay: number) => ({
    close: 97,
    drawdown: -0.2,
    gainPerDay,
    gapToLevel: -0.03,
    level: 100,
    quietDays: 145,
    riseDays: 45,
    symbol,
  });

  it('orders the fastest recoveries first and drops the slowest tail', () => {
    const ranked = rankQuietComebacks(
      [candidate('SLOW', 0.001), candidate('FAST', 0.01), candidate('MID', 0.005)],
      0.34
    );

    expect(
      ranked.map(entry => entry.symbol),
      'the slowest decile underperformed its universe, so it is excluded rather than ranked last'
    ).toEqual(['FAST', 'MID']);
  });

  it('keeps one candidate rather than returning an empty list', () => {
    const ranked = rankQuietComebacks([candidate('ONLY', 0.004)], 0.3);

    expect(ranked, 'trimming a single candidate to nothing would hide the only match').toHaveLength(1);
  });
});
