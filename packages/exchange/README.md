# @typedtrader/exchange

Typed broker clients for algorithmic trading in TypeScript. Trade through [Alpaca](https://alpaca.markets/) or [Trading212](https://www.trading212.com/) with one consistent API — every response validated at runtime (zod), all money math in arbitrary precision (big.js), live candles streamed over WebSocket.

## Installation

```sh
npm install @typedtrader/exchange
```

The package is ESM-only and targets the latest Node.js LTS.

## Features

- **One broker API for every broker:** place market/limit orders, list balances, watch fills and candles — identical methods whether you trade through Alpaca or Trading212
- **Paper trading:** both brokers support a sandbox environment via a single `usePaperTrading` flag
- **Runtime validation:** every API response is parsed with zod schemas — malformed data fails loudly instead of corrupting your strategy
- **High precision:** `big.js` for order sizes, prices, and fees — no floating-point drift
- **Streaming candles:** WebSocket-fed minute bars, batched into larger timeframes using human-readable intervals (e.g. `"5m"`, `"1h"`)
- **Fee awareness:** `getFeeRates()` / `estimateFee()` let strategies subtract round-trip costs before entering a position

## Quick Start: Alpaca

```ts
import {getAlpacaClient, TradingPair} from '@typedtrader/exchange';

const broker = getAlpacaClient({
  apiKey: 'ALPACA_API_KEY',
  apiSecret: 'ALPACA_API_SECRET',
  usePaperTrading: true,
});

await broker.verifyCredentials();

const pair = new TradingPair('AAPL', 'USD');
const latest = await broker.getLatestCandle(pair, 60_000);
await broker.placeLimitOrder(pair, {side: 'BUY', size: '1', price: latest.close});
```

**Why Alpaca:**

- **Commission-free** US stocks and ETFs, with fractional shares.
- **Free paper trading** that mirrors the live API, so strategies can be validated without risking capital.
- **Free market data** via the IEX feed, including WebSocket-streamed minute bars (the source this package pairs with other brokers).
- **Crypto** trades 24/7 alongside equities.
- **[24/5 trading](https://docs.alpaca.markets/us/docs/245-trading)** of US stocks via an overnight session, so positions can be opened or closed from Sunday evening through Friday evening.
- **Add funds commission-free** with [Revolut](https://www.revolut.com/), avoiding the transfer fees most banks charge.

**Resources:** [API Reference](https://docs.alpaca.markets/reference/) · [OpenAPI Files](https://docs.alpaca.markets/openapi) · [24/5 Trading](https://docs.alpaca.markets/us/docs/245-trading)

## Quick Start: Trading212

Trading212's API has **no historical bars and no WebSocket**, so the broker is paired with an external market-data source. For US equities, Alpaca's feed is the natural choice — it is free, works with a paper account, and streams minute bars over WebSocket:

```ts
import {AlpacaMarketData, getTrading212Client, TradingPair} from '@typedtrader/exchange';

// 1. Construct an Alpaca-backed market-data source.
const marketData = new AlpacaMarketData({
  apiKey: 'ALPACA_API_KEY',
  apiSecret: 'ALPACA_API_SECRET',
  usePaperTrading: false, // read-only; doesn't place orders
});

// 2. Wire it into the Trading212 broker.
const broker = getTrading212Client({
  apiKey: 'TRADING212_API_KEY',
  apiSecret: 'TRADING212_API_SECRET',
  usePaperTrading: true,
  marketData, // required — Trading212 has no candles of its own
});

// 3. Use the broker as if it provided everything natively. Symbol mapping is automatic:
// Trading212's `AAPL_US_EQ` is stripped to Alpaca's `AAPL` behind the scenes.
const pair = new TradingPair('AAPL_US_EQ', 'USD');
const latest = await broker.getLatestCandle(pair, 60_000); // → from Alpaca's WebSocket
await broker.placeLimitOrder(pair, {side: 'BUY', size: '1', price: latest.close}); // → Trading212
```

**Why Trading212:**

- **Commission-free** investing in 13,000+ stocks and ETFs, with fractional shares from £1/€1.
- **Broad UK, European, and US coverage.**
- **Multi-currency accounts** for depositing and investing in 13 currencies.
- **Tax-advantaged Stocks & Shares ISA** (and Cash ISA) for UK residents, with no account fees.
- **Daily [interest](https://www.trading212.com/interest-on-cash)** paid on uninvested cash.

**Good to know:**

- **Coverage mismatch.** Alpaca's free IEX feed covers US equities (and crypto). Trading212's universe includes European and UK instruments that Alpaca has no data for; those tickers will fail at `getCandles` even though Trading212 can trade them. Pair with a different data source (Bloomberg, Polygon, EODHD, Twelve Data) for non-US coverage.
- **Cross-currency fees.** Trading212 debits a currency-conversion fee on cross-currency trades (e.g. a EUR account buying USD instruments) at ~0.15% per leg. `getFeeRates()` surfaces this as `CURRENCY_CONVERSION_FEE`; `estimateFee()` includes it in the total.
- **Order updates are polled.** Trading212 has no order-stream WebSocket, so `watchOrders` polls once per minute (matching Trading212's documented rate limit). Fills arrive within ~60 seconds rather than push-style.

**Resources:** [API Documentation](https://docs.trading212.com/api) · [Fees](https://helpcentre.trading212.com/hc/en-us/articles/11471996799517)

## Raw API Access

Prefer direct REST calls over the broker abstraction? The low-level clients are exported too, with zod-validated responses and rate-limit-aware retries built in:

```ts
import {Trading212API} from '@typedtrader/exchange';

const api = new Trading212API({
  apiKey: 'TRADING212_API_KEY',
  apiSecret: 'TRADING212_API_SECRET',
  usePaperTrading: true,
});

const cash = await api.getAccountCash();
const positions = await api.getPositions();
const orders = await api.getHistoryOrders(); // auto-paginates
```

`AlpacaAPI` offers the same for Alpaca.

## Bring Your Own Broker

Alpaca and Trading212 are first-class, but any broker can be integrated:

- **Extend the abstract `Broker` class** and your integration plugs straight into the `trading-strategies` package's `TradingSession` (live trading) and `BacktestExecutor` (backtesting) — no extra wiring.
- **Extend `MarketDataSource`** to stream candles from your own data provider. Execution and market data are deliberately separated, so any data source can be paired with any broker.

See [`BROKER_TEMPLATE.md`](https://github.com/bennycode/trading-signals/blob/main/packages/exchange/BROKER_TEMPLATE.md) for the conventions every integration follows.
