import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import type {Candle} from '../Broker.js';
import {OrderSide, OrderType} from '../Broker.js';
import {TradingPair} from '../TradingPair.js';
import {AlpacaBrokerMock} from './AlpacaBrokerMock.js';

const pair = new TradingPair('BTC', 'USD');

function createCandle(overrides: Partial<Candle> & {open: string; close: string}): Candle {
  const openNum = parseFloat(overrides.open);
  const closeNum = parseFloat(overrides.close);
  return {
    base: 'BTC',
    close: overrides.close,
    counter: 'USD',
    high: overrides.high ?? String(Math.max(openNum, closeNum)),
    low: overrides.low ?? String(Math.min(openNum, closeNum)),
    open: overrides.open,
    openTimeInISO: overrides.openTimeInISO ?? '2025-01-01T00:00:00.000Z',
    openTimeInMillis: overrides.openTimeInMillis ?? 1735689600000,
    sizeInMillis: overrides.sizeInMillis ?? 60000,
    volume: overrides.volume ?? '100',
  };
}

describe('AlpacaBrokerMock', () => {
  it('threads the slippage config through to fills', async () => {
    const exchange = new AlpacaBrokerMock({
      balances: new Map([
        ['BTC', {available: new Big(0), hold: new Big(0)}],
        ['USD', {available: new Big(10000), hold: new Big(0)}],
      ]),
      feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
      slippage: {rate: new Big('0.01')},
    });

    exchange.processCandle(createCandle({close: '100', open: '100'}));

    await exchange.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});

    const fills = exchange.processCandle(
      createCandle({close: '110', open: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'})
    );

    expect(fills).toHaveLength(1);
    expect(fills[0].price, '105 open + 1% slippage').toBe('106.05');
  });

  it('threads the fillModel config through to fills', async () => {
    const exchange = new AlpacaBrokerMock({
      balances: new Map([
        ['BTC', {available: new Big(0), hold: new Big(0)}],
        ['USD', {available: new Big(10000), hold: new Big(0)}],
      ]),
      feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
      fillModel: {priceImprovement: false},
    });

    exchange.processCandle(createCandle({close: '500', open: '500'}));

    await exchange.placeLimitOrder(pair, {price: '380', side: OrderSide.BUY, size: '1'});

    const fills = exchange.processCandle(
      createCandle({close: '380', high: '400', low: '350', open: '360', openTimeInISO: '2025-01-01T00:01:00.000Z'})
    );

    expect(fills).toHaveLength(1);
    expect(fills[0].price, 'fills at the limit price itself, not the candle open').toBe('380');
  });

  it('defaults to no slippage and price improvement enabled', async () => {
    const exchange = new AlpacaBrokerMock({
      balances: new Map([
        ['BTC', {available: new Big(0), hold: new Big(0)}],
        ['USD', {available: new Big(10000), hold: new Big(0)}],
      ]),
      feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
    });

    exchange.processCandle(createCandle({close: '100', open: '100'}));

    await exchange.placeMarketOrder(pair, {side: OrderSide.BUY, size: '1', sizeInCounter: false});

    const fills = exchange.processCandle(
      createCandle({close: '110', open: '105', openTimeInISO: '2025-01-01T00:01:00.000Z'})
    );

    expect(fills[0].price).toBe('105');
  });
});
