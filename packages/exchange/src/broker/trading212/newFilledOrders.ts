import type {Trading212API} from './api/Trading212API.js';
import type {HistoryOrder} from './api/schema/HistoryOrderSchema.js';
import {Trading212OrderStatus} from './api/schema/OrderSchema.js';

function isFilled(item: HistoryOrder) {
  return item.order.id != null && item.order.status === Trading212OrderStatus.FILLED;
}

/** Highest filled order id in `items`, used as the baseline so historical fills are not replayed. */
export function latestFilledOrderId(items: HistoryOrder[]) {
  return items.filter(isFilled).reduce((max, item) => Math.max(max, item.order.id ?? 0), 0);
}

/**
 * Filled orders newer than `lastSeenId`, oldest first. Pages through history (newest first)
 * until it reaches an id already seen. Without this loop, more than 50 fills between polls
 * would silently drop the older ones off the first page.
 */
export async function fetchFilledOrdersSince(api: Pick<Trading212API, 'getHistoryOrdersPage'>, lastSeenId: number) {
  const newFills: HistoryOrder[] = [];
  let nextPath: string | null = null;
  do {
    const page = await api.getHistoryOrdersPage(nextPath ? {nextPath} : undefined);
    const seenIndex = page.items.findIndex(item => item.order.id != null && item.order.id <= lastSeenId);
    const unseen = seenIndex === -1 ? page.items : page.items.slice(0, seenIndex);
    newFills.push(...unseen.filter(item => isFilled(item) && item.fill));
    nextPath = seenIndex === -1 ? page.nextPagePath : null;
  } while (nextPath);

  return newFills.sort((a, b) => (a.order.id ?? 0) - (b.order.id ?? 0));
}
