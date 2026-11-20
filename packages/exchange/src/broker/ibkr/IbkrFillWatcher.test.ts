import {describe, expect, it} from 'vitest';
import {OrderPosition, OrderSide, type Fill} from '../Broker.js';
import {TradingPair} from '../TradingPair.js';
import {mergeFills, toExecutionKey} from './IbkrFillWatcher.js';

describe('toExecutionKey', () => {
  it('prefers IBKR’s own execution id', () => {
    expect(toExecutionKey({execution_id: '0000e1a7.69123abc.01.01', order_id: 55, trade_time_r: 1_000})).toBe(
      '0000e1a7.69123abc.01.01'
    );
  });

  it('tells two executions of one order apart without an execution id', () => {
    const first = toExecutionKey({conid: 265598, order_id: 55, price: '11.55', size: 1, trade_time_r: 1_000});
    const second = toExecutionKey({conid: 265598, order_id: 55, price: '11.56', size: 1, trade_time_r: 1_000});

    expect(first, 'two partial fills of the same order at the same instant are separate executions').not.toBe(second);
  });

  it('does not collapse unrelated executions that both lack an id and an order id', () => {
    const ford = toExecutionKey({conid: 9599491, price: '11.55', side: 'B', size: 1});
    const apple = toExecutionKey({conid: 265598, price: '190.5', side: 'S', size: 10});

    expect(ford, 'a nullish order id must not reduce every manual trade to one key').not.toBe(apple);
  });

  it('reports the same key for the same trade across polls', () => {
    const trade = {conid: 9599491, order_id: 55, price: '11.55', side: 'B', size: 1, trade_time_r: 1_000};

    expect(toExecutionKey(trade)).toBe(toExecutionKey({...trade}));
  });
});

describe('mergeFills', () => {
  /** IBKR fills a four-share order as one share and then three, each its own execution. */
  const execution = (createdAt: string, size: string, price: string, fee: string): Fill => ({
    created_at: createdAt,
    fee,
    feeAsset: 'USD',
    order_id: '55',
    pair: new TradingPair('F', 'USD'),
    position: OrderPosition.LONG,
    price,
    side: OrderSide.BUY,
    size,
  });

  const OPENING = execution('2026-11-20T01:00:00.000Z', '1', '11.50', '0.35');
  const CLOSING = execution('2026-11-20T01:00:09.000Z', '3', '11.60', '0.35');

  it('sums the executions into one fill', () => {
    const merged = mergeFills([OPENING, CLOSING]);

    expect(merged?.size, 'a strategy is handed the order, not the executions it arrived in').toBe('4');
    expect(merged?.price, 'quantity-weighted, so the three shares count for three').toBe('11.575');
    expect(merged?.fee, 'IBKR bills each execution, and the order paid both').toBe('0.7');
  });

  it('timestamps the fill from the earliest execution whichever order they arrive in', () => {
    expect(
      mergeFills([OPENING, CLOSING])?.created_at,
      'the order started filling then, and the trades feed hands them over oldest-first'
    ).toBe(OPENING.created_at);

    expect(
      mergeFills([CLOSING, OPENING])?.created_at,
      'getFillByOrderId sorts newest-first, and must not therefore report a later time for the same order'
    ).toBe(OPENING.created_at);
  });

  it('reports nothing for an order with no executions', () => {
    expect(mergeFills([])).toBeUndefined();
  });
});
