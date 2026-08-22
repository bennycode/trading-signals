# @typedtrader/exchange

Typed broker clients for algorithmic trading in TypeScript. Trade through brokers like [Alpaca](https://alpaca.markets/) and [Trading212](https://www.trading212.com/) with one consistent API: every response validated at runtime (zod), all money math in arbitrary precision (big.js), live candles streamed over WebSocket.

### [Install](#installation) · [Brokers](#supported-brokers) · [Quick Start](#quick-start-alpaca) · [CLI](#command-line-interface) · [Raw API](#raw-api-access) · [Rate Limits](#rate-limiting) · [Extend](#bring-your-own-broker)

## Motivation

This package provides a unified trading API for traditional brokers like Alpaca and Trading212. Write your strategy against one typed `Broker` contract and it runs on any supported broker, the way [CCXT](https://github.com/ccxt/ccxt) does it for crypto exchanges.

It also covers more of trading than the basic paths most broker APIs wrap: long and short positions, market and limit orders, fills, fee estimation, and trading rules.

## Installation

```sh
npm install @typedtrader/exchange
```

The package is ESM-only and targets the latest Node.js LTS.

## Features

- **One API for every broker:** place market/limit orders, list balances, watch fills and candles with the same methods on every supported broker
- **Paper trading:** a single `usePaperTrading` flag switches a broker to its sandbox environment
- **Runtime validation:** every API response is parsed with zod schemas, so malformed data fails loudly instead of corrupting your strategy
- **High precision:** `big.js` for order sizes, prices, and fees, with no floating-point drift
- **Streaming candles:** WebSocket-fed minute bars, batched into larger timeframes using human-readable intervals (e.g. `"5m"`, `"1h"`)
- **Fee awareness:** `getFeeRates()` / `estimateFee()` let strategies subtract round-trip costs before entering a position
- **Agent-friendly CLI:** inspect accounts and manage orders from the terminal with JSON output, built for coding agents like Claude Code as much as for humans (see [CLI](#command-line-interface))

## Supported Brokers

| id | name | markets | paper trading | market data | order updates | API docs |
| --- | --- | --- | :-: | --- | --- | --- |
| `alpaca` | [Alpaca](https://alpaca.markets/) | US stocks, ETFs, crypto | ✅ | ✅ IEX feed, WebSocket streamed | ✅ WebSocket stream | [docs.alpaca.markets](https://docs.alpaca.markets/reference/) |
| `trading212` | [Trading212](https://www.trading212.com/) | 13,000+ US/UK/EU stocks and ETFs | ✅ | ❌ bring your own source | 🔁 polled (~60s) | [docs.trading212.com](https://docs.trading212.com/api) |

More brokers are planned, and the `Broker` abstraction is built for it (see [Bring Your Own Broker](#bring-your-own-broker)).

You create the API keys yourself in each broker's dashboard. The package uses your credentials but never creates accounts or keys for you: [Alpaca API keys](https://docs.alpaca.markets/us/docs/getting-started) · [Trading212 API keys](https://helpcentre.trading212.com/hc/en-us/articles/14584770928157-Trading-212-API-key)

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

Trading212's API has no historical bars and no WebSocket, so the broker is paired with an external market-data source. For US equities, Alpaca's feed is the natural choice: it is free, works with a paper account, and streams minute bars over WebSocket.

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
  marketData, // required: Trading212 has no candles of its own
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

- **Cross-currency fees.** Trading212 debits a currency-conversion fee on cross-currency trades (e.g. a EUR account buying USD instruments) at ~0.15% per leg. `getFeeRates()` surfaces this as `CURRENCY_CONVERSION_FEE`; `estimateFee()` includes it in the total.
- **Order updates are polled.** Trading212 has no order-stream WebSocket, so `watchOrders` polls once per minute (matching Trading212's documented rate limit). Fills arrive within ~60 seconds rather than push-style.

**Resources:** [API Documentation](https://docs.trading212.com/api) · [Fees](https://helpcentre.trading212.com/hc/en-us/articles/11471996799517)

## Command-Line Interface

The package ships an `exchange-cli` binary that covers account inspection and the full order lifecycle on any supported broker:

```sh
exchange-cli balances --broker trading212
exchange-cli instruments rolls-royce --broker trading212
exchange-cli quote RRl_EQ --broker trading212 --counter GBX
exchange-cli buy RRl_EQ 1 --broker trading212 --limit 1000 --dry-run
exchange-cli buy RRl_EQ 1 --broker trading212 --limit 1000
exchange-cli wait RRl_EQ 53700021713 --broker trading212 --counter GBX --timeout 5m
exchange-cli cancel RRl_EQ 53700021713 --broker trading212 --counter GBX
exchange-cli watch-candles ETH --broker alpaca --counter USD --take 3
```

That covers the whole agent trade loop: check the price (`quote`), validate the order against trading rules and estimated fees without placing it (`--dry-run`), place it, block until it fills or dies (`wait`), and stream live candles or fills as NDJSON (`watch-candles` / `watch-orders`, one JSON object per line, `--take n` to exit after n events).

Credentials come from environment variables following the pattern `<BROKER>_PAPER_API_KEY` / `<BROKER>_LIVE_API_KEY` (plus the matching `_API_SECRET`), e.g. `TRADING212_PAPER_API_KEY`. The CLI loads them from `.env.live` when `--live` is passed and from `.env.sandbox` otherwise (both optional; variables already present in the environment win). Keeping the live credentials in their own file means a machine without `.env.live` simply cannot trade the real account. Run `exchange-cli help` for all commands.

The CLI is designed to be driven by coding agents (Claude Code, Codex, ...) as much as by humans:

- **JSON on stdout** — every command result is machine-readable, no table scraping
- **Errors are diagnostic** — the broker's raw problem type (e.g. `/api-errors/extended-hours-trading-not-allowed`) goes to stderr verbatim, with exit code 1
- **Safe by default** — paper trading unless `--live` is passed, so an agent cannot touch real money without you spelling it out
- **Stream guard rails** — Alpaca serves one market-data WebSocket per API key, so a second `watch-*` on the same machine fails fast naming the process that holds the connection, and `--idle <duration>` turns a silently starved stream (e.g. a bot on another machine took the slot) into a quick diagnostic failure
- **Exercises the production path** — commands run through the same `Broker` clients your strategies use, so a working CLI call proves the integration works

Point your agent at this section, or drop the command list into its project instructions, and it can verify balances, look up tickers, and test order flows without writing throwaway scripts.

## Raw API Access

The low-level REST clients are exported too, for direct calls without the broker abstraction. They keep the zod-validated responses and rate-limit-aware retries:

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

Every broker integration exports its raw client the same way (`AlpacaAPI`, `Trading212API`, ...).

## Rate Limiting

Brokers enforce rate limits. The package respects them automatically:

- **Automatic retries with broker-aware delays.** Every client uses `axios-retry`, with retry delays calibrated per endpoint to the broker's documented limits (e.g. Trading212 account cash: 1 req / 2s, order history: 1 req / 60s), so a rate-limited request waits exactly as long as it must.
- **Polling matches documented limits.** Where the package polls (Trading212's `watchOrders`), the interval defaults to the broker's documented rate limit rather than hammering the API.
- **Transient network errors** (`EAI_AGAIN`, HTTP 429/5xx) are retried transparently; non-retryable errors (401, 403, validation failures) surface immediately.

## Bring Your Own Broker

The built-in integrations are first-class, but any broker can be added:

- **Extend the abstract `Broker` class** and your integration plugs straight into the `trading-strategies` package's `TradingSession` (live trading) and `BacktestExecutor` (backtesting) with no extra wiring.
- **Extend `MarketDataSource`** to stream candles from your own data provider. Execution and market data are deliberately separated, so any data source can be paired with any broker.

See [`BROKER_TEMPLATE.md`](https://github.com/bennycode/trading-signals/blob/main/packages/exchange/BROKER_TEMPLATE.md) for the conventions every integration follows.
