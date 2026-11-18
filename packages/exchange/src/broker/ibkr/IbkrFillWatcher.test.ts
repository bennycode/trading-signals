import {describe, expect, it} from 'vitest';
import {toExecutionKey} from './IbkrFillWatcher.js';

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
