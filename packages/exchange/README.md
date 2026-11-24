# @typedtrader/exchange

Typed broker clients for algorithmic trading in TypeScript. Trade through brokers like [Alpaca](https://alpaca.markets/) and [Trading212](https://www.trading212.com/) with one consistent API: every response validated at runtime (zod), all money math in arbitrary precision (big.js), live candles streamed over WebSocket.

### [Install](#installation) · [Brokers](#supported-brokers) · [Quick Start](#quick-start) · [Raw API](#raw-api-access) · [Rate Limits](#rate-limiting) · [Extend](#bring-your-own-broker)

## Motivation

This package provides a unified trading API for traditional brokers like Alpaca and Trading212. Write your strategy against one typed `Broker` contract and it runs on any supported broker, the way [CCXT](https://github.com/ccxt/ccxt) does it for crypto exchanges.

It also covers more of trading than the basic paths most broker APIs wrap: long and short positions, market and limit orders, fills, fee estimation, and trading rules.

## Installation

```sh
npm install @typedtrader/exchange
```

The package is ESM-only and targets the latest Node.js LTS.

To drive the brokers from a terminal instead of code, install [@typedtrader/exchange-cli](../exchange-cli).

## Features

- **One API for every broker:** place market/limit orders, list balances, watch fills and candles with the same methods on every supported broker
- **Paper trading:** every supported broker offers one, reached by a flag where the broker has a sandbox endpoint and by paper credentials where it does not
- **Runtime validation:** every API response is parsed with zod schemas, so malformed data fails loudly instead of corrupting your strategy
- **High precision:** `big.js` for order sizes, prices, and fees, with no floating-point drift
- **Streaming candles:** WebSocket-fed minute bars, batched into larger timeframes using human-readable intervals (e.g. `"5m"`, `"1h"`)
- **Fee awareness:** `getFeeRates()` / `estimateFee()` let strategies subtract round-trip costs before entering a position

## Supported Brokers

| id | name | markets | paper trading | market data | order updates | API docs |
| --- | --- | --- | :-: | --- | --- | --- |
| `alpaca` | [Alpaca](https://alpaca.markets/) | US stocks, ETFs, crypto | ✅ | ✅ IEX feed, WebSocket streamed | ✅ WebSocket stream | [docs.alpaca.markets](https://docs.alpaca.markets/reference/) |
| `trading212` | [Trading212](https://www.trading212.com/) | 13,000+ US/UK/EU stocks and ETFs | ✅ | ❌ bring your own source | 🔁 polled (~60s) | [docs.trading212.com](https://docs.trading212.com/api) |
| `ibkr` | [Interactive Brokers](https://www.interactivebrokers.com/) | US stocks and ETFs, 24/5 overnight | ✅ separate paper login | ✅ own history endpoint | 🔁 polled (~5s) | [Web API](https://www.interactivebrokers.com/docs/web-api/getting-started) |

More brokers are planned, and the `Broker` abstraction is built for it (see [Bring Your Own Broker](#bring-your-own-broker)).

You create the credentials yourself in each broker's dashboard. The package uses them but never creates accounts or keys for you; each broker's README links the page to create them on.

## Quick Start

Every broker is constructed by its own `get…Client` function and then used through the same `Broker` methods:

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

Swap `getAlpacaClient` for `getTrading212Client` or `getIbkrClient` and the rest of the code is unchanged. What differs per broker is how it authenticates, where its candles come from and which of them it needs supplied — each broker's README covers that:

- [**Alpaca**](src/broker/alpaca/README.md) — API keys, its own free market data
- [**Trading212**](src/broker/trading212/README.md) — API keys, needs an external market-data source
- [**Interactive Brokers**](src/broker/ibkr/README.md) — no API keys; a local gateway holds the session

To pick a broker at runtime from stored credentials instead, `getBrokerClient({exchangeId, apiKey, apiSecret, isPaper})` constructs whichever one `exchangeId` names.

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
