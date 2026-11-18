import type {MarketDataSource} from '../MarketDataSource.js';
import type {IbkrAPI} from './api/IbkrAPI.js';
import {IbkrBroker} from './IbkrBroker.js';

export function getIbkrClient(options?: {
  /** Discovered from the session when omitted. */
  accountId?: string;
  /** Defaults to {@link IbkrAPI.URL_GATEWAY}, the address IBKR's own `conf.yaml` listens on. */
  gatewayUrl?: string;
  /** Defaults to IBKR's own history endpoint; pass a source only to use another provider's feed. */
  marketData?: MarketDataSource;
  /** Routes limit orders to IBKR Overnight (20:00–03:50 ET). Limit orders only. */
  overnight?: boolean;
  /** `GTC` (default) rests until filled or cancelled; `DAY` expires at the close. */
  timeInForce?: 'DAY' | 'GTC';
}): IbkrBroker {
  return new IbkrBroker(options);
}
