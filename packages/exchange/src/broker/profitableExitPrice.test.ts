import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import type {Fill} from './Broker.js';
import {OrderPosition, OrderSide, OrderType} from './orderEnums.js';
import {
  resolveEntry,
  resolveProfitableExitPrice,
  roundToTick,
  solveExitPrice,
  type ExitPriceBroker,
} from './profitableExitPrice.js';
import {TradingPair} from './TradingPair.js';

const F_USD = new TradingPair('F', 'USD');
const CENT = new Big('0.01');

/**
 * IBKR's US equity tariff: a third of a cent per share, never less than a dollar per order. The
 * floor is what stops the fee being a rate, so the fee at the answer is not a fixed multiple of
 * the fee at the first guess and there is no percentage to divide a target by.
 */
function perShareWithFloor(size: Big, floor = '1', perShare = '0.0035') {
  return async () => {
    const fee = new Big(perShare).mul(size);
    return fee.lt(floor) ? new Big(floor) : fee;
  };
}

function fill(overrides: Partial<Fill> = {}): Fill {
  return {
    created_at: '2026-11-20T15:00:00.000Z',
    fee: '0.12',
    feeAsset: 'USD',
    order_id: 'order-1',
    pair: F_USD,
    position: OrderPosition.LONG,
    price: '11.55',
    side: OrderSide.BUY,
    size: '1',
    ...overrides,
  };
}

describe('roundToTick', () => {
  it('rounds a long exit up so the snap never gives away the profit it solved for', () => {
    expect(roundToTick(new Big('11.791'), CENT, Big.roundUp).toFixed()).toBe('11.8');
  });

  it('rounds a short exit down, which costs the venue the fraction instead', () => {
    expect(roundToTick(new Big('11.791'), CENT, Big.roundDown).toFixed()).toBe('11.79');
  });

  it('leaves the price alone when the venue quotes no tick', () => {
    expect(
      roundToTick(new Big('11.791'), new Big(0), Big.roundUp).toFixed(),
      'dividing by a zero tick would throw rather than decline to round'
    ).toBe('11.791');
  });
});

describe('solveExitPrice', () => {
  it('clears the profit against a fee that is not a rate', async () => {
    const size = new Big('1');

    const result = await solveExitPrice({
      currency: 'USD',
      entryFee: new Big('1'),
      entryPrice: new Big('11.55'),
      estimateExitFee: perShareWithFloor(size),
      isShort: false,
      minProfit: CENT,
      size,
      tick: CENT,
    });

    expect(result.entryValue.toFixed(), "a long's basis includes what it paid to get in").toBe('12.55');
    expect(result.exitFee.toFixed(), 'one share hits the per-order floor, not the per-share rate').toBe('1');
    expect(
      result.profit.gte(CENT),
      'a target solved from a fee percentage would land under water, because the floor is most of the cost here'
    ).toBe(true);
  });

  it('re-prices the fee at each candidate instead of at the first guess', async () => {
    const seen: string[] = [];

    const result = await solveExitPrice({
      currency: 'USD',
      entryFee: new Big('0'),
      entryPrice: new Big('100'),
      estimateExitFee: async (notional, price) => {
        seen.push(price.toFixed());
        return notional.mul('0.01');
      },
      isShort: false,
      minProfit: new Big('1'),
      size: new Big('1'),
      tick: CENT,
    });

    expect(seen[0], 'the first candidate only covers the entry and the profit asked for').toBe('101');
    expect(
      seen.length,
      'a fee that grows with the price is larger at the answer than at the guess, so one round cannot settle it'
    ).toBeGreaterThan(1);
    expect(seen.at(-1), 'the fee that comes back is the one charged at the price being returned').toBe(
      result.price.toFixed()
    );
    expect(result.profit.gte(new Big('1'))).toBe(true);
  });

  it('gives up after a bounded number of rounds on a fee curve that never settles', async () => {
    let rounds = 0;

    await solveExitPrice({
      currency: 'USD',
      entryFee: new Big('0'),
      entryPrice: new Big('100'),
      estimateExitFee: async (_notional, price) => {
        rounds++;
        return price.mul('0.5');
      },
      isShort: false,
      minProfit: new Big('1'),
      size: new Big('1'),
      tick: CENT,
    });

    expect(
      rounds,
      'a fee that chases the price upwards diverges, and spinning here would hang the caller'
    ).toBeLessThanOrEqual(8);
  });

  it('refuses a short whose buy-back fee eats the whole budget', async () => {
    const size = new Big('1');

    await expect(
      solveExitPrice({
        currency: 'USD',
        entryFee: new Big('0'),
        entryPrice: new Big('0.5'),
        estimateExitFee: perShareWithFloor(size),
        isShort: true,
        minProfit: CENT,
        size,
        tick: CENT,
      }),
      'the dollar floor alone exceeds the 50 cents the short took in, so no placeable price closes it'
    ).rejects.toThrow(/exceeds|at or below zero/);
  });
});

describe('resolveEntry', () => {
  const noFill = async () => undefined;

  it('treats a hypothetical price as long unless told otherwise', async () => {
    const resolved = await resolveEntry(F_USD, {price: '11.55', size: '1'}, OrderSide.BUY, noFill);

    expect(resolved.side).toBe(OrderSide.BUY);
    expect(resolved.fee.toFixed(), 'an entry quoted without a fee is priced as free rather than guessed at').toBe('0');
  });

  it('takes the side from the execution rather than the default', async () => {
    const resolved = await resolveEntry(F_USD, {orderId: 'order-1'}, OrderSide.BUY, async () =>
      fill({side: OrderSide.SELL})
    );

    expect(
      resolved.side,
      'reading a short entry as a purchase moves the target the wrong way and guarantees a loss'
    ).toBe(OrderSide.SELL);
    expect(resolved.fee.toFixed(), 'the fee the execution actually charged, not an estimate').toBe('0.12');
  });

  it('explains an order id it cannot find instead of inventing a basis', async () => {
    await expect(resolveEntry(F_USD, {orderId: 'nope'}, OrderSide.BUY, noFill)).rejects.toThrow(
      /No fill found for order "nope"/
    );
  });
});

describe('resolveProfitableExitPrice', () => {
  function createBroker(overrides: Partial<ExitPriceBroker> = {}): ExitPriceBroker {
    return {
      estimateFee: async () => ({total: new Big('1')}),
      getFillByOrderId: async () => fill(),
      getName: () => 'TestBroker',
      getTradingRules: async () => ({counter_increment: '0.01'}),
      ...overrides,
    };
  }

  it('refuses to add a fee in one currency to a price in another', async () => {
    await expect(
      resolveProfitableExitPrice({
        broker: createBroker(),
        entry: {price: '11.55', size: '1'},
        feeAsset: 'EUR',
        pair: F_USD,
      }),
      'summing EUR fees into a USD price yields a confident target that means nothing'
    ).rejects.toThrow(/Pass `feeToCounterRate`/);
  });

  it('converts both fee legs once a rate is supplied', async () => {
    const result = await resolveProfitableExitPrice({
      broker: createBroker(),
      entry: {fee: '1', price: '11.55', size: '1'},
      feeAsset: 'EUR',
      options: {feeToCounterRate: '2'},
      pair: F_USD,
    });

    expect(result.entryFee.toFixed(), 'a EUR fee of 1 at a rate of 2 is 2 of the counter currency').toBe('2');
    expect(result.exitFee.toFixed(), 'the exit leg converts by the same rate').toBe('2');
    expect(result.currency, 'everything reported is denominated in the counter currency').toBe('USD');
  });

  it('refuses a position of no size', async () => {
    await expect(
      resolveProfitableExitPrice({
        broker: createBroker(),
        entry: {price: '11.55', size: '0'},
        feeAsset: 'USD',
        pair: F_USD,
      })
    ).rejects.toThrow(/Cannot price an exit for a position of 0 F/);
  });

  it('estimates a limit exit on the real share count, not a notional to divide', async () => {
    const asked: {orderType: OrderType; size: string | undefined}[] = [];

    await resolveProfitableExitPrice({
      broker: createBroker({
        estimateFee: async (_pair, orderType, _notional, ticket) => {
          asked.push({orderType, size: ticket?.size?.toFixed()});
          return {total: new Big('1')};
        },
      }),
      entry: {price: '11.55', size: '3'},
      feeAsset: 'USD',
      pair: F_USD,
    });

    expect(asked[0]?.orderType, 'a take-profit is placed as a limit order, so that is the tariff to price it at').toBe(
      OrderType.LIMIT
    );
    expect(
      asked[0]?.size,
      'a broker billing per share would otherwise divide the notional by the current quote, which prices a different number of shares than the exit sells'
    ).toBe('3');
  });

  it('reports the side that closes the position, not the one that opened it', async () => {
    const long = await resolveProfitableExitPrice({
      broker: createBroker(),
      entry: {price: '11.55', size: '1'},
      feeAsset: 'USD',
      pair: F_USD,
    });

    expect(long.entrySide).toBe(OrderSide.BUY);
    expect(long.exitSide, 'a long is closed by selling').toBe(OrderSide.SELL);
  });
});
