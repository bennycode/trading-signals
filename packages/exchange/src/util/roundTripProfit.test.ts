import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {calculateRoundTripProfit, isProfitableAfterFees} from './roundTripProfit.js';

describe('calculateRoundTripProfit', () => {
  // 0.1% maker on the buy, 0.2% taker on the sell — typical exchange fees.
  const fees = {entryFeeRate: 0.001, exitFeeRate: 0.002};

  it('reports a profit when the sale clears both fees', () => {
    const result = calculateRoundTripProfit({entryPrice: 100, exitPrice: 101, quantity: 1, ...fees});
    expect(result.isProfitable).toBe(true);
    // entryCost = 100 * 1.001 = 100.1; exitProceeds = 101 * 0.998 = 100.798.
    expect(result.entryCost.toNumber()).toBeCloseTo(100.1, 10);
    expect(result.exitProceeds.toNumber()).toBeCloseTo(100.798, 10);
    expect(result.netProfit.toNumber()).toBeCloseTo(0.698, 10);
  });

  it('reports a loss even when the sell price is ABOVE the buy price, because fees eat the gain', () => {
    // Sold higher (100 -> 100.2) yet still loses money once both fees are paid.
    const result = calculateRoundTripProfit({entryPrice: 100, exitPrice: 100.2, quantity: 1, ...fees});
    expect(result.isProfitable).toBe(false);
    expect(result.netProfit.lt(0)).toBe(true);
    // exitProceeds = 100.2 * 0.998 = 99.9996; entryCost = 100.1 -> net = -0.1004.
    expect(result.netProfit.toNumber()).toBeCloseTo(-0.1004, 10);
  });

  it('computes the break-even sell price that clears both fees', () => {
    const result = calculateRoundTripProfit({entryPrice: 100, exitPrice: 100.2, quantity: 1, ...fees});
    // 100 * 1.001 / 0.998 = 100.300601...
    expect(result.breakEvenPrice.toNumber()).toBeCloseTo(100.300601, 6);

    // Selling at the break-even price nets ~0.
    const atBreakEven = calculateRoundTripProfit({
      entryPrice: 100,
      exitPrice: result.breakEvenPrice,
      quantity: 1,
      ...fees,
    });
    expect(atBreakEven.netProfit.toNumber()).toBeCloseTo(0, 6);

    // A hair below break-even loses; a hair above profits.
    const below = calculateRoundTripProfit({
      entryPrice: 100,
      exitPrice: result.breakEvenPrice.minus('0.01'),
      quantity: 1,
      ...fees,
    });
    const above = calculateRoundTripProfit({
      entryPrice: 100,
      exitPrice: result.breakEvenPrice.plus('0.01'),
      quantity: 1,
      ...fees,
    });
    expect(below.isProfitable).toBe(false);
    expect(above.isProfitable).toBe(true);
  });

  it('scales net profit with quantity', () => {
    const one = calculateRoundTripProfit({entryPrice: 50, exitPrice: 55, quantity: 1, ...fees});
    const ten = calculateRoundTripProfit({entryPrice: 50, exitPrice: 55, quantity: 10, ...fees});
    expect(ten.netProfit.toNumber()).toBeCloseTo(one.netProfit.mul(10).toNumber(), 10);
    // Profitability does not depend on quantity.
    expect(ten.isProfitable).toBe(one.isProfitable);
  });

  it('reports net profit as a percentage of the amount invested', () => {
    const result = calculateRoundTripProfit({entryPrice: 100, exitPrice: 101, quantity: 3, ...fees});
    const expected = result.netProfit.div(result.entryCost).mul(100);
    expect(result.netProfitPercent.toNumber()).toBeCloseTo(expected.toNumber(), 10);
  });

  it('treats a sale below the entry price as a loss', () => {
    const result = calculateRoundTripProfit({entryPrice: 100, exitPrice: 99, quantity: 1, ...fees});
    expect(result.isProfitable).toBe(false);
  });

  it('with zero fees, is profitable whenever the exit price exceeds the entry price', () => {
    const result = calculateRoundTripProfit({
      entryFeeRate: 0,
      entryPrice: 100,
      exitFeeRate: 0,
      exitPrice: 100.01,
      quantity: 1,
    });
    expect(result.isProfitable).toBe(true);
    expect(result.breakEvenPrice.toNumber()).toBeCloseTo(100, 10);
  });

  it('accepts Big and string inputs', () => {
    const result = calculateRoundTripProfit({
      entryFeeRate: '0.001',
      entryPrice: new Big('100'),
      exitFeeRate: '0.002',
      exitPrice: '101',
      quantity: new Big('2'),
    });
    expect(result.isProfitable).toBe(true);
  });

  it('throws when the exit fee rate is 100% or more (break-even is unreachable)', () => {
    expect(() =>
      calculateRoundTripProfit({entryFeeRate: 0, entryPrice: 100, exitFeeRate: 1, exitPrice: 101, quantity: 1})
    ).toThrowError(/below 1/);
  });
});

describe('isProfitableAfterFees', () => {
  it('mirrors the verdict from calculateRoundTripProfit', () => {
    const input = {entryFeeRate: 0.001, entryPrice: 100, exitFeeRate: 0.002, exitPrice: 100.2, quantity: 1};
    expect(isProfitableAfterFees(input)).toBe(calculateRoundTripProfit(input).isProfitable);
    expect(isProfitableAfterFees(input)).toBe(false);
    expect(isProfitableAfterFees({...input, exitPrice: 105})).toBe(true);
  });
});
