import type {IbkrAPI} from './api/IbkrAPI.js';
import type {IbkrLiveOrder} from './api/schema/OrderSchema.js';
import {IbkrBrokerMapper} from './IbkrBrokerMapper.js';

/** How many times to re-ask for the order list while IBKR reports it incomplete. */
export const IBKR_SNAPSHOT_ATTEMPTS = 5;

export const IBKR_SNAPSHOT_RETRY_MS = 250;

/**
 * The live-order list, once IBKR says it is complete.
 *
 * `snapshot: false` means IBKR is still assembling the list, and the response schema says so.
 * Treating that as authoritative returns an empty list while orders are working, which makes
 * `cancelOpenOrders` report success having cancelled nothing and lets a session start blind to
 * its own pending orders. Bounded, so a gateway that never settles fails loudly rather than
 * spinning.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/api-reference/trading/order-management
 */
export async function getCompleteIbkrLiveOrders(api: IbkrAPI): Promise<IbkrLiveOrder[]> {
  for (let attempt = 0; attempt < IBKR_SNAPSHOT_ATTEMPTS; attempt++) {
    const response = await api.getLiveOrders();

    if (response.snapshot !== false) {
      return response.orders ?? [];
    }

    await new Promise(resolve => setTimeout(resolve, IBKR_SNAPSHOT_RETRY_MS));
  }

  throw new Error(
    `IBKR did not finish assembling its order list after ${IBKR_SNAPSHOT_ATTEMPTS} attempts, so it cannot be told apart from an account with no open orders.`
  );
}

/**
 * Whether IBKR still lists the order as live, which is what makes its executions partial.
 *
 * A partially filled order already has executions in the trades feed, so this is how a caller
 * tells "filled" from "filling" before reporting a fill for it.
 */
export async function isIbkrOrderWorking(api: IbkrAPI, orderId: string): Promise<boolean> {
  const orders = await getCompleteIbkrLiveOrders(api);

  return orders.some(order => String(order.orderId) === orderId && IbkrBrokerMapper.isLiveOrder(order));
}
