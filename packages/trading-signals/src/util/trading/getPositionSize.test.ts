import {getPositionSize} from './getPositionSize.js';

describe('getPositionSize', () => {
  it('sizes the position so that the stop costs exactly the risk budget', () => {
    const size = getPositionSize(10_000, 1, 50, 47.5);

    expect(size, 'risking 1% of 10,000 over a 2.50 stop distance buys 40 units').toBe(40);
    expect((50 - 47.5) * size, 'being stopped out loses exactly the 100 that was budgeted').toBe(100);
  });

  it('returns a larger position for a tighter stop', () => {
    const wide = getPositionSize(10_000, 1, 50, 47.5);
    const tight = getPositionSize(10_000, 1, 50, 49);

    expect(tight).toBe(100);
    expect(tight, 'halving the stop distance doubles the size for the same risk').toBeGreaterThan(wide);
  });

  it('sizes a short position from a stop above the entry', () => {
    expect(getPositionSize(10_000, 1, 50, 52.5), 'only the distance between entry and stop matters').toBe(40);
  });

  it('returns a fractional size for assets that trade in fractions', () => {
    expect(getPositionSize(1_000, 2, 30_000, 29_500)).toBe(0.04);
  });

  it('scales linearly with the risk percentage', () => {
    const single = getPositionSize(10_000, 1, 50, 47.5);
    const double = getPositionSize(10_000, 2, 50, 47.5);

    expect(double).toBe(single * 2);
  });

  it('throws an error when the account value is not positive', () => {
    expect(() => getPositionSize(0, 1, 50, 47.5)).toThrowError(
      'Cannot size a position against a non-positive account value.'
    );
  });

  it('throws an error when the risk percentage is not positive', () => {
    expect(() => getPositionSize(10_000, 0, 50, 47.5)).toThrowError(
      'Cannot size a position against a non-positive risk percentage.'
    );
  });

  it('throws an error when a price is not positive', () => {
    expect(() => getPositionSize(10_000, 1, 50, 0)).toThrowError('Cannot size a position from a non-positive price.');
  });

  it('throws an error when the entry price equals the stop price', () => {
    expect(() => getPositionSize(10_000, 1, 50, 50)).toThrowError(
      'Cannot size a position when the entry price equals the stop price.'
    );
  });

  it('throws an error for NaN inputs, which slip past the range checks', () => {
    const message = 'Cannot size a position from inputs that do not produce a finite size.';

    expect(
      () => getPositionSize(NaN, 1, 50, 47.5),
      'NaN <= 0 is false, so the account check lets it through'
    ).toThrowError(message);
    expect(() => getPositionSize(10_000, NaN, 50, 47.5)).toThrowError(message);
    expect(() => getPositionSize(10_000, 1, NaN, 47.5)).toThrowError(message);
    expect(() => getPositionSize(10_000, 1, 50, NaN)).toThrowError(message);
  });

  it('throws an error for infinite inputs', () => {
    expect(() => getPositionSize(Infinity, 1, 50, 47.5)).toThrowError(
      'Cannot size a position from inputs that do not produce a finite size.'
    );
  });

  it('throws an error when finite inputs overflow to an infinite size', () => {
    expect(
      () => getPositionSize(Number.MAX_VALUE, 100, 1, 1 + Number.EPSILON),
      'a vanishing stop distance blows the size past what a double can hold'
    ).toThrowError('Cannot size a position from inputs that do not produce a finite size.');
  });
});
