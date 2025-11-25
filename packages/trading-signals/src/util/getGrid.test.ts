import {getGrid} from './getGrid.js';

describe('getGrid', () => {
  it('calculates an arithmetic grid', () => {
    const expectations = [95, 97, 99, 101, 103, 105];
    const config = {
      levels: 6,
      lower: 95,
      spacing: 'arithmetic',
      upper: 105,
    } as const;
    const grid = getGrid(config);
    expect(grid.length).toBe(config.levels);
    expect(grid).toStrictEqual(expectations);
  });

  it('calculates a geometric grid', () => {
    const expectations = ['95.00', '96.92', '98.88', '100.88', '102.92', '105.00'];
    const config = {
      levels: 6,
      lower: 95,
      spacing: 'geometric',
      upper: 105,
    } as const;
    const grid = getGrid(config);
    expect(grid.length).toStrictEqual(config.levels);
    expect(grid.map(level => level.toFixed(2))).toEqual(expectations);
  });

  it('supports tick sizes to define precision', () => {
    const expectations = ['95.00', '97.00', '99.00', '101.00', '103.00', '105.00'];
    const config = {
      levels: 6,
      lower: 95,
      spacing: 'geometric',
      tickSize: 1,
      upper: 105,
    } as const;
    const grid = getGrid(config);
    expect(grid.length).toStrictEqual(config.levels);
    expect(grid.map(level => level.toFixed(2))).toEqual(expectations);
  });
});
