import type {IbkrAPI} from './api/IbkrAPI.js';

/**
 * Confirms the gateway holds a usable session, and says how to fix it when it does not.
 *
 * There are no credentials to check here: the Client Portal Gateway owns the login and signs the
 * requests, so "are we authenticated" is a question about that process rather than about keys.
 */
export async function verifyIbkrSession(api: IbkrAPI, getAccountId: () => Promise<string>): Promise<void> {
  const status = await api.getAuthStatus().catch(() => undefined);

  if (!status?.authenticated) {
    // Opening a session is enough when the gateway is logged in but the session has lapsed.
    const initialized = await api.initSession().catch(() => undefined);
    if (!initialized?.authenticated) {
      throw new Error(
        `The IBKR Client Portal Gateway at ${api.defaults.baseURL} has no authenticated session. ` +
          `Log in at ${api.defaults.baseURL} and approve the two-factor prompt.${
            status?.message ? ` Gateway reported: ${status.message}` : ''
          }`
      );
    }
  }

  await getAccountId();
}
