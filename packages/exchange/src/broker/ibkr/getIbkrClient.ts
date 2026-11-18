import type {MarketDataSource} from '../MarketDataSource.js';
import type {IbkrAPI} from './api/IbkrAPI.js';
import type {IbkrGatewayState} from './gateway/IbkrGatewayLauncher.js';
import {IbkrBroker} from './IbkrBroker.js';

/**
 * An IBKR client.
 *
 * Given `account` and `password` it runs the Client Portal Gateway itself — downloaded on first
 * use, started, and logged into — so nothing has to be set up by hand. That path needs the
 * optional `playwright` peer dependency, since the gateway's login form is built by client-side
 * JavaScript and has nothing to post to.
 *
 * Construction does not block. A fresh login pushes to the phone and waits for a tap, so await
 * {@link IbkrBroker.ready} (or watch `onGatewayStateChange`) rather than assuming the first call
 * can go out immediately — though calls made before then simply wait rather than failing.
 *
 * Omit the credentials to use a gateway that is already logged in.
 */
export function getIbkrClient(options?: {
  /** IBKR Pro username. With `password`, the gateway is launched and logged in for you. */
  account?: string;
  /** Discovered from the session when omitted. */
  accountId?: string;
  /** Defaults to {@link IbkrAPI.URL_GATEWAY}, the address IBKR's own `conf.yaml` listens on. */
  gatewayUrl?: string;
  /** Defaults to IBKR's own history endpoint; pass a source only to use another provider's feed. */
  marketData?: MarketDataSource;
  /** Progress while the gateway comes up, including when it is waiting on the IB Key push. */
  onGatewayStateChange?: (state: IbkrGatewayState) => void;
  /** Routes limit orders to IBKR Overnight (20:00-03:50 ET). Limit orders only. */
  overnight?: boolean;
  /** IBKR Pro password. Only ever typed into the gateway's own login form. */
  password?: string;
  /** `GTC` (default) rests until filled or cancelled; `DAY` expires at the close. */
  timeInForce?: 'DAY' | 'GTC';
  /** Which second factor to pick when the account has more than one enrolled. */
  twoFactorMethod?: string;
}): IbkrBroker {
  return new IbkrBroker(options);
}
