import {IbkrBroker} from './IbkrBroker.js';
import type {IbkrBrokerOptions} from './IbkrBrokerOptions.js';

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
export function getIbkrClient(options?: IbkrBrokerOptions): IbkrBroker {
  return new IbkrBroker(options);
}
