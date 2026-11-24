# Interactive Brokers

US stocks and ETFs with 24/5 overnight trading, candles included. IBKR's retail Web API authenticates through the Client Portal Gateway, a local Java process that holds a logged-in session and signs requests, so this broker carries no API keys of its own. Give it your IBKR credentials and it runs that gateway for you — downloading it on first use, starting it, and logging in:

```sh
npm install @typedtrader/exchange playwright
```

```ts
import {getIbkrClient, TradingPair} from '@typedtrader/exchange';

const broker = getIbkrClient({
  account: process.env.IBKR_USERNAME,
  password: process.env.IBKR_PASSWORD,
  onGatewayStateChange: ({stage}) => console.info(`gateway: ${stage}`),
});

// Approve the IB Key push on your phone; calls made before then wait rather than fail.
await broker.ready;

// No market-data source needed: IBKR serves its own candles.
const pair = new TradingPair('F', 'USD');
const latest = await broker.getLatestCandle(pair, 86_400_000);
await broker.placeLimitOrder(pair, {side: 'BUY', size: '1', price: latest.close});
```

`playwright` is an **optional peer dependency**, needed only for this automated login: the gateway's login page builds its form in client-side JavaScript, so there is nothing to post credentials to and a real browser has to drive it. Installing `@typedtrader/exchange` on its own pulls no browser, so an Alpaca-only user pays nothing for it.

To use a gateway you manage yourself, omit `account` and `password`. Inside this repository that is what the bundled launcher is for:

```sh
npm run gateway:ibkr:op   # resolves IBKR_USERNAME / IBKR_PASSWORD from 1Password
```

## Paper Trading

IBKR's paper account has **its own username and its own account number** (`DU…`, against `U…` for the account holding real money), and the Web API has no live/paper switch to flip. The credentials decide which environment the session lands in, so paper trading means logging the gateway in as the paper user:

```ts
const broker = getIbkrClient({
  account: process.env.IBKR_PAPER_USERNAME,
  password: process.env.IBKR_PAPER_PASSWORD,
  paper: true, // refuses the session if it turns out to be a live account
});
```

Inside this repository, the bundled launcher logs the gateway into either one:

```sh
npm run gateway:ibkr:paper:op   # the paper login
npm run gateway:ibkr:op         # the live login
```

It prints the username it is logging in as, so you can see which environment you are about to approve a second factor for.

`paper` is a check rather than a switch. Set it and a session on the wrong side is refused on the first call, which is the difference between a configuration error and a strategy placing real orders while believing it is simulated. Leave it unset to trade whatever the gateway is logged into.

Find the paper username under **Client Portal → Settings → Account Configuration → Paper Trading Account**, and set a password there with _Reset Paper Trading Password_ if you have never used it. Identical live and paper credentials cause login errors, so give the paper account its own.

That screen shows the paper **username** next to the paper **account number** (`DU…`). The username is the login; the account number is not, and the gateway rejects it.

## Why Interactive Brokers

- **Candles included**, so no second data provider is needed — unlike Trading212. They are delayed without a market-data subscription, though; see _Good to know_ below.
- **Fee estimates from IBKR itself.** `estimateFee()` prices the exact order through IBKR's `whatif` preview rather than modelling the commission schedule.
- **[24/5 overnight trading](https://www.interactivebrokers.com/en/trading/orders/overnight-trading-orders.php)** of US stocks and ETFs, from 20:00 to 03:50 ET.
- **Automatic FX.** A USD instrument bought from a EUR account is funded by an IDEALPRO conversion, which the trades feed reports alongside the fill.

## Trading Permissions

Permissions are **per product**, and a product you have not been granted is refused at submission rather than at account level. Open **Client Portal → Settings → Account Settings → Trading Permissions**, where each product is a tile that is either already granted or carries a _Request_ button:

- **Stocks** is what this package needs, and it is also what IBKR says is sufficient for overnight trading — there is no separate overnight tile to request.
- **Stock, Index and Forex CFDs** must be activated there before any CFD can be traded. It is the usual route to a short position for an account without margin, though this package trades stocks rather than CFDs.
- **Currency/Forex** covers the IDEALPRO conversions that fund a cross-currency trade.

## Good to know

- **The session needs a human.** The login is automated, but IBKR's 2FA sends an IB Key push that has to be approved on your phone, and the session expires roughly daily, which brings another push. A passkey cannot be used: IBKR's Web API supports IB Key, Handy Key, SMS and DSC+ only. `getIbkrClient` therefore does not block: construction returns immediately, `broker.ready` is the awaitable, and `onGatewayStateChange` reports progress (`downloading` → `starting` → `awaiting-two-factor` → `authenticated`) so an application can say what it is waiting for. A gateway that is already logged in is reused rather than re-authenticated, which keeps the pushes to roughly one a day.
- **The login form is IBKR's to change.** Its field and dropdown selectors live in `gateway/loginToIbkrGateway.ts`; a redesign there is what breaks the login, and a failed attempt leaves a screenshot in `.gateway-outputs/`.
- **Market data may be delayed, candles included.** Without a market-data subscription for the relevant exchange, bars arrive roughly 15 minutes behind the market — measured across three US equities at once, all lagging 15.1–15.2 minutes. The quote feed separately reports `D` (delayed) and can return no price fields at all during regular hours. Nothing errors, so the delay is only visible by comparing a bar's open time against the clock. Two consequences worth planning for: `estimateFee()` and `getFeeRates()` price off a close from a quarter of an hour ago, and `watchCandles()` anchored at `new Date()` emits nothing until the feed catches up to that anchor — pass an `openTimeInISO` behind the delay if you want bars immediately. A subscription is bought per exchange in **Client Portal → Settings → User Settings → Market Data Subscriptions**.
- **Order updates are polled.** `watchOrders` polls the trades endpoint rather than opening IBKR's WebSocket, which needs its own handshake and re-subscribes on every reconnect.
- **The orders snapshot lags.** `/iserver/account/orders` does not include an order placed moments earlier, and can still report a filled order as working, so do not read it back immediately after placing.
- **A daily bar on an overnight-opening venue arrives late.** IBKR stamps a daily bar with its session open, so a bar counts as closed once the UTC date it opened on has passed. Where a session cannot fit in the rest of that UTC day (an ASX session opens 23:00 UTC and closes 05:00 UTC) the bar is held until a full 24 hours after the open instead, which is hours later than the real close. Never earlier, so a strategy is never handed a partial session. US and European listings are unaffected, as are all intraday intervals.
- **Confirmation prompts are answered yes.** IBKR can answer a submission with prompts (price far from the market, size above average daily volume) that must be replied to before the order exists. A strategy has nobody at the keyboard, so each is confirmed and logged with `console.warn` — that log is the only record that IBKR objected, and it is worth reading when a fill looks inexplicable.

## Resources

[Web API](https://www.interactivebrokers.com/docs/web-api/getting-started) · [API Reference](https://www.interactivebrokers.com/docs/openapi/api-reference.json) · [Paper Trading](https://www.interactivebrokers.com/docs/web-api/authentication/paper) · [Overnight Trading](https://www.interactivebrokers.com/en/trading/orders/overnight-trading-orders.php)
