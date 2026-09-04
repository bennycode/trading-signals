import {describe, expect, it} from 'vitest';
import {getFilledBaseAmount, OrderPosition, OrderSide, type Fill} from './Broker.js';
import {TradingPair} from './TradingPair.js';

const BTC_USD = new TradingPair('BTC', 'USD');

function fill(overrides: Partial<Fill> = {}): Fill {
  return {
    created_at: '2026-09-04T19:43:21.705Z',
    fee: '0',
    feeAsset: 'USD',
    order_id: 'order-1',
    pair: BTC_USD,
    position: OrderPosition.LONG,
    price: '79660.975468455',
    side: OrderSide.BUY,
    size: '0.001254903',
    ...overrides,
  };
}

describe('getFilledBaseAmount', () => {
  it('subtracts a fee the venue took out of the base asset', () => {
    /*
     * Observed on a live Alpaca account: a market BUY executed for 0.001254903 BTC and the position
     * grew by 0.001251765, because the 0.25% taker fee was deducted from the credited BTC rather
     * than charged in USD.
     */
    const amount = getFilledBaseAmount(fill({fee: '0.000003138', feeAsset: 'BTC'}));

    expect(amount.toFixed(), 'the fee never arrives, so the position grows by less than it executed').toBe(
      '0.001251765'
    );
  });

  it('returns the executed size when the fee is charged in the counter currency', () => {
    const amount = getFilledBaseAmount(fill({fee: '0.25', feeAsset: 'USD'}));

    expect(amount.toFixed(), 'a counter-denominated fee costs cash, not base').toBe('0.001254903');
  });

  it('returns the executed size on a SELL even when the fee is base-denominated', () => {
    const amount = getFilledBaseAmount(fill({fee: '0.000003138', feeAsset: 'BTC', side: OrderSide.SELL}));

    expect(amount.toFixed(), 'a SELL is credited in the counter asset, so all of the base leaves').toBe('0.001254903');
  });

  it('returns the executed size when no fee was charged', () => {
    expect(getFilledBaseAmount(fill()).toFixed()).toBe('0.001254903');
  });

  it('keeps size and price multiplying to what the trade cost', () => {
    const executed = fill({fee: '0.000003138', feeAsset: 'BTC'});
    const notional = Number(executed.size) * Number(executed.price);

    expect(notional.toFixed(4), 'size stays gross so cost-basis math still sees the full outlay').toBe('99.9668');
    expect(getFilledBaseAmount(executed).lt(executed.size), 'while the amount actually received is smaller').toBe(true);
  });
});
