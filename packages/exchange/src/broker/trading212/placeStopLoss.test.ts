import {describe, expect, it} from 'vitest';
import {findOwnStops, toStopLossOrder} from './placeStopLoss.js';
import {OrderSchema, type Order} from './api/schema/OrderSchema.js';

describe('toStopLossOrder', () => {
  const position = {averagePrice: 309.98003663, currentPrice: 310.24, quantity: 10.84547262, ticker: 'NET_US_EQ'};

  it('puts the stop the requested percentage below the average entry', () => {
    expect(toStopLossOrder(position, 10).stopPrice, 'rounded to whole cents').toBe(278.98);
  });

  it('asks for the validity spelling that Trading212 accepts', () => {
    expect(toStopLossOrder(position, 10).timeValidity, '"GTC" is rejected as an invalid payload').toBe(
      'GOOD_TILL_CANCEL'
    );
  });

  it('sells the whole position', () => {
    expect(toStopLossOrder(position, 10).quantity, 'a negative quantity is what makes it a SELL').toBe(-10.84547262);
  });

  it('refuses a stop that the current price already sits below', () => {
    expect(() => toStopLossOrder({...position, currentPrice: 200}, 10)).toThrow(/would sell immediately/);
  });

  it('refuses a position that is not long', () => {
    expect(() => toStopLossOrder({...position, quantity: 0}, 10)).toThrow(/No long position/);
  });
});

describe('findOwnStops', () => {
  it('matches stops for the given ticker only', () => {
    const orders: Order[] = [
      {id: 1, ticker: 'NET_US_EQ', type: 'STOP'},
      {id: 2, ticker: 'NET_US_EQ', type: 'LIMIT'},
      {id: 3, ticker: 'AAPL_US_EQ', type: 'STOP'},
    ].map(order => OrderSchema.parse({...order, status: 'NEW', strategy: 'QUANTITY'}));

    expect(findOwnStops(orders, 'NET_US_EQ').map(order => order.id)).toEqual([1]);
  });
});
