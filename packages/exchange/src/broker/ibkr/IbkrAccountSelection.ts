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
export async function resolveIbkrAccountId(input: {
  /** Narrowed to the two calls this makes, so a test stands one up without the rest of the API. */
  api: Pick<IbkrAPI, 'getAccounts' | 'selectAccount'>;
  /**
   * Which environment the caller believes it is trading. The session is checked against it rather
   * than switched to it, because the Web API offers nothing to switch: a mismatch means somebody
   * would place real orders thinking they were simulated, which is worth a refusal.
   */
  paper?: boolean | undefined;
  requested?: string | undefined;
}): Promise<string> {
  const {api, paper, requested} = input;
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

  if (paper !== undefined && paper !== isIbkrPaperAccount(accountId)) {
    throw new Error(
      paper
        ? `The IBKR gateway is logged in as live account "${accountId}", but paper trading was asked for, and orders placed on it would spend real money. Log the gateway in with the paper username from Client Portal → Settings → Account Configuration → Paper Trading Account.`
        : `The IBKR gateway is logged in as paper account "${accountId}", but live trading was asked for, so every order would be simulated and the results would not be real. Log the gateway in with the live username.`
    );
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

/**
 * Whether an account number belongs to IBKR's simulated environment.
 *
 * IBKR numbers paper accounts `DU…`, or `DF…` under an advisor, against `U…` and `F…` for the
 * accounts that hold real money. The prefix is the only thing in the session that says which kind
 * it is: the Web API has no live/paper switch, so a paper account is reached by logging the gateway
 * in as the paper user and nothing in the response announces that.
 *
 * @see https://www.interactivebrokers.com/docs/web-api/authentication/paper
 */
export function isIbkrPaperAccount(accountId: string): boolean {
  const id = accountId.toUpperCase();
  return id.startsWith('DU') || id.startsWith('DF');
}
