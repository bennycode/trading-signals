import type {MarketDataSource} from '../MarketDataSource.js';
import type {IbkrTimeInForce} from './api/schema/OrderSchema.js';
import type {IbkrGatewayState} from './gateway/IbkrGatewayLauncher.js';

/** How an {@link IbkrBroker} talks to the gateway and what it does with the orders it sends. */
export interface IbkrBrokerOptions {
  /**
   * IBKR Pro username. Supply it with {@link password} and the broker runs the gateway itself:
   * downloading it on first use, starting it, and logging in.
   *
   * Leave both out to talk to a gateway somebody else has already logged in, which is what the
   * repo's own `npm run gateway:ibkr:op` provides.
   */
  account?: string;
  accountId?: string;
  gatewayUrl?: string;
  /**
   * Called as the gateway comes up. The useful one is `awaiting-two-factor`: IBKR has pushed to
   * the phone and nothing proceeds until somebody taps it, so this is the moment to say so rather
   * than appear hung.
   */
  onGatewayStateChange?: (state: IbkrGatewayState) => void;
  /**
   * IBKR Pro password, used only to fill the gateway's login form and never sent anywhere else.
   * Requires {@link account}, and requires the optional `playwright` peer dependency, because
   * that form is built in client-side JavaScript and cannot be posted to directly.
   */
  password?: string;
  /** Which second factor to pick when the account has more than one enrolled. */
  twoFactorMethod?: string;
  /**
   * Routes limit orders to IBKR Overnight, the 20:00–03:50 ET session, which together with the
   * regular and extended sessions gives near-continuous weekday coverage.
   *
   * Off by default, because it is not a widening of a day order: the overnight venue is separate,
   * carries its own liquidity and spreads, and only limit orders reach it — a market order is
   * refused rather than quietly held until the opening bell.
   *
   * No extra permission is needed: Client Portal lists permissions per product and has no
   * overnight tile, and IBKR states that an existing US stock permission covers the session.
   *
   * Failure here is silent, so recognise it rather than debug it. An order IBKR will not honour
   * is still accepted, reports `tif: OND` and `Submitted`, and is then cancelled unfilled once
   * the session opens, with no reason on the order and `warning_message: null`. A `whatif`
   * preview does not catch it either, since it prices a ticket it will never route.
   */
  overnight?: boolean;
  /**
   * How long an unfilled order rests. `GTC` by default, so an order survives the close rather
   * than being silently discarded — IBKR accepts it for every order type and alongside
   * `outsideRTH`, so nothing here forces `DAY`. Alpaca makes the same choice wherever its API
   * allows it.
   *
   * Pass `DAY` for a strategy that re-places its orders each candle, so yesterday's unfilled
   * order cannot fire on a thesis that has since expired.
   *
   * Ignored when `overnight` is set, which needs its own time-in-force to reach that venue.
   */
  timeInForce?: typeof IbkrTimeInForce.DAY | typeof IbkrTimeInForce.GTC;
  /**
   * Another provider's feed, for instruments IBKR serves no bars for. Defaults to
   * {@link IbkrMarketData}, so IBKR's own history endpoint supplies candles and no second
   * provider is needed. An injected source's lifecycle belongs to whoever constructed it —
   * `disconnect()` does not close it.
   */
  marketData?: MarketDataSource;
}
