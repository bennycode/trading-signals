import {describe, expect, it, vi} from 'vitest';
import type {HistoryOrder, HistoryOrderPage} from './api/schema/HistoryOrderSchema.js';
import {fetchFilledOrdersSince, latestFilledOrderId} from './newFilledOrders.js';

function filled(id: number): HistoryOrder {
  return {fill: {price: 1, quantity: 1}, order: {id, status: 'FILLED'}};
}

function pages(...items: HistoryOrderPage[]) {
  const getHistoryOrdersPage = vi.fn<(options?: {nextPath?: string}) => Promise<HistoryOrderPage>>();
  for (const page of items) {
    getHistoryOrdersPage.mockResolvedValueOnce(page);
  }
  return {getHistoryOrdersPage};
}

describe('latestFilledOrderId', () => {
  it('ignores orders that are not filled', () => {
    expect(latestFilledOrderId([filled(3), {order: {id: 9, status: 'CANCELLED'}}, filled(5)])).toBe(5);
  });
});

describe('fetchFilledOrdersSince', () => {
  it('pages until it reaches a seen id and returns the new fills oldest first', async () => {
    const api = pages(
      {items: [filled(7), filled(6)], nextPagePath: '/page2'},
      {items: [filled(5), filled(4), filled(3)], nextPagePath: '/page3'}
    );

    const fills = await fetchFilledOrdersSince(api, 4);

    expect(fills.map(item => item.order.id)).toEqual([5, 6, 7]);
    expect(api.getHistoryOrdersPage, 'stops paging once a seen id shows up').toHaveBeenCalledTimes(2);
    expect(api.getHistoryOrdersPage).toHaveBeenLastCalledWith({nextPath: '/page2'});
  });

  it('skips unfilled orders and fills without fill details', async () => {
    const api = pages({
      items: [{order: {id: 9, status: 'CANCELLED'}}, {order: {id: 8, status: 'FILLED'}}, filled(7)],
      nextPagePath: null,
    });

    const fills = await fetchFilledOrdersSince(api, 0);

    expect(fills.map(item => item.order.id)).toEqual([7]);
  });
});
