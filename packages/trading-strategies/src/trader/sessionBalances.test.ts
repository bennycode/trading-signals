import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import {AlpacaBroker, OrderPosition, TradingPair} from '@typedtrader/exchange';
import type {Balance} from '@typedtrader/exchange';
import {holdsPosition, ownedBase, sessionBalances} from './sessionBalances.js';
import type {TradingSessionState} from './TradingSessionTypes.js';

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

function stateWith(base: string, baseOnHold: string, minimumSize = '0.000000001'): TradingSessionState {
  return {
    baseBalance: new Big(base),
    baseBalanceOnHold: new Big(baseOnHold),
    counterBalance: new Big(0),
    feeRates: AlpacaBroker.DEFAULT_CRYPTO_FEE_RATES,
    hasOutstandingBuy: false,
    hasOutstandingSell: false,
    shortBase: new Big(0),
    tradingRules: {...AlpacaBroker.DEFAULT_FRACTIONAL_TRADING_RULES, base_min_size: minimumSize, pair},
  };
}

describe('ownedBase', () => {
  it('counts what a resting order holds as part of the position', () => {
    expect(ownedBase(stateWith('0', '1.5')).toFixed(), 'all of it is offered, none of it is sold').toBe('1.5');
    expect(ownedBase(stateWith('0.5', '1.5')).toFixed()).toBe('2');
  });
});

describe('holdsPosition', () => {
  it('holds a position that is entirely inside a resting order', () => {
    expect(
      holdsPosition(stateWith('0', '1')),
      'a strategy whose whole position sits in its own exit offer still has one'
    ).toBe(true);
  });

  it('counts a position exactly at the minimum order size', () => {
    expect(holdsPosition(stateWith('0.01', '0', '0.01')), 'the minimum is tradable, so it is a position').toBe(true);
  });

  it('does not count dust below the minimum order size', () => {
    expect(holdsPosition(stateWith('0.009', '0', '0.01')), 'what cannot be sold is not a position').toBe(false);
  });

  it('reports a short position rather than reading it as something to hold', () => {
    const balances = [
      {available: '5', currency: pair.base, hold: '2', position: OrderPosition.SHORT},
      {available: '100', currency: pair.counter, hold: '0', position: OrderPosition.LONG},
    ];

    const result = sessionBalances(balances, pair);

    expect(
      result.base.plus(result.baseOnHold).toFixed(),
      'selling to protect a short would make the short bigger, so the long-only rules see nothing'
    ).toBe('0');
    expect(result.shortBase.toFixed(), 'all of it is short, whether it is reserved or not').toBe('7');
    expect(result.counter.toFixed(), 'the cash is still the account cash').toBe('100');
  });
});
