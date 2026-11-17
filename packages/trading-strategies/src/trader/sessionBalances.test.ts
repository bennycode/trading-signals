import {describe, expect, it} from 'vitest';
import {OrderPosition, TradingPair} from '@typedtrader/exchange';
import type {Balance} from '@typedtrader/exchange';
import {sessionBalances} from './sessionBalances.js';

const pair = new TradingPair('BTC', 'USDT');

function balance(currency: string, available: string, hold: string): Balance {
  return {available, currency, hold, position: OrderPosition.LONG};
}

describe('sessionBalances', () => {
  it('keeps what a broker is holding apart from what can be spent', () => {
    const balances = [balance('BTC', '0.5', '1.5'), balance('USDT', '1000', '0')];

    const result = sessionBalances(balances, pair);

    expect(result.base.toFixed(), 'only the unreserved part is spendable').toBe('0.5');
    expect(result.baseOnHold.toFixed(), 'the reserved part is still owned').toBe('1.5');
    expect(result.counter.toFixed()).toBe('1000');
  });

  it('reads a broker that reserves nothing and reports the whole position as available', () => {
    const result = sessionBalances([balance('BTC', '2', '0')], pair);

    expect(
      result.base.plus(result.baseOnHold).toFixed(),
      'Alpaca puts the whole position in available, so the position has to come out the same'
    ).toBe('2');
  });

  it('is nothing at all for a pair the account holds neither side of', () => {
    const result = sessionBalances([balance('ETH', '5', '1')], pair);

    expect(result.base.toFixed()).toBe('0');
    expect(result.baseOnHold.toFixed()).toBe('0');
    expect(result.counter.toFixed()).toBe('0');
  });
});
