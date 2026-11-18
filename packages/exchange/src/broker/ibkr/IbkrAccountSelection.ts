import type {IbkrAPI} from './api/IbkrAPI.js';

/**
 * Settles which account a broker works on and makes the gateway agree.
 *
 * Placement, cancellation and balances all name the account in their path, but order monitoring
 * reads whichever account the session has selected. Without this step, a broker constructed with
 * `{accountId: 'U2'}` against a session sitting on U1 places orders in U2 and reads U1's open
 * orders — so `getOpenOrders` misses the order it just placed and `cancelOpenOrders` cancels
 * nothing and reports success.
 *
 * The switch is verified rather than assumed, because a session can be held by more than one
 * client and anyone else holding it can move it.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/v1/endpoints/order-monitoring/live-orders
 */
export async function resolveIbkrAccountId(input: {api: IbkrAPI; requested?: string}): Promise<string> {
  const {api, requested} = input;
  const accounts = await api.getAccounts();

  if (requested && !accounts.accounts.includes(requested)) {
    throw new Error(
      `The IBKR session does not serve account "${requested}". It has: ${accounts.accounts.join(', ') || '(none)'}.`
    );
  }

  const accountId = requested ?? accounts.selectedAccount ?? accounts.accounts[0];

  if (!accountId) {
    throw new Error('The IBKR session reports no accounts.');
  }

  if (accounts.selectedAccount === accountId) {
    return accountId;
  }

  await api.selectAccount(accountId);

  const reselected = await api.getAccounts();
  if (reselected.selectedAccount !== accountId) {
    throw new Error(
      `IBKR did not switch the session to account "${accountId}" (it reports "${reselected.selectedAccount ?? 'none'}" selected), so order monitoring would read a different account than orders are placed in.`
    );
  }

  return accountId;
}
