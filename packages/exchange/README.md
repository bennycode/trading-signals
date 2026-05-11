# @typedtrader/exchange

Utilities for handling trading exchange data with proper type safety and aggregation.

## Features

- **Candle Batching:** Aggregates multiple exchange candles into larger timeframes
- **Type Safety:** Zod schemas for runtime validation of exchange data
- **High Precision:** Uses `big.js` for arbitrary-precision decimal arithmetic
- **Event-Driven:** Built-in EventEmitter for streaming candle updates
- **Flexible Intervals:** Timeframes using human-readable strings (e.g., "1h", "5m")

## Design Decisions

The `Broker` interface is intentionally kept generic so that any broker can implement it. This means:

- **Bring your own broker.** Alpaca and Trading212 are first-class, but the package is built to be extended.
- **Extend the abstract `Broker` class** and your integration plugs straight into `TradingSession` for live strategies and `BacktestExecutor` for backtesting — both for free, with no extra wiring. See [`BROKER_TEMPLATE.md`](./BROKER_TEMPLATE.md) for the conventions every integration follows.
- **Extend `MarketDataSource`** to add live-streaming candles for your strategies. If your broker has no market-data API, plug in an existing source (e.g. Alpaca) instead — execution and market data are deliberately separated so they can be mixed and matched.

## Alpaca

This package includes a first-class [Alpaca](https://alpaca.markets/) implementation.

```ts
import {getAlpacaClient} from '@typedtrader/exchange';

const exchange = getAlpacaClient({
  apiKey: process.env.ALPACA_API_KEY,
  apiSecret: process.env.ALPACA_API_SECRET,
  usePaperTrading: true,
});
```

**Resources:**

- [Alpaca API Reference](https://docs.alpaca.markets/reference/)
- [Alpaca OpenAPI Files](https://docs.alpaca.markets/openapi)

## Trading212

[Trading212](https://www.trading212.com/) is supported as a broker. Its API has **no historical bars and no WebSocket**, so `Trading212Broker` requires an external `MarketDataSource` for candle methods.

The package separates **execution** (`Broker`) from **market data** (`MarketDataSource`) so any data provider can be paired with any broker. For US equities, Alpaca's market-data feed is the natural pairing as it is free, works with a paper account, and supports WebSocket-streamed minute bars:

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

**Caveats:**

- **Coverage mismatch.** Alpaca's free IEX feed covers US equities (and crypto). Trading212's universe includes European and UK instruments that Alpaca doesn't have data for; those tickers will fail at `getCandles` even though Trading212 can trade them. Pair with a different data source (Bloomberg, Polygon, EODHD, Twelve Data) for non-US coverage.
- **Cross-currency fees.** Trading212 debits a currency-conversion fee on cross-currency trades (e.g. a EUR account buying USD instruments) at ~0.15% per leg. `Trading212Broker.getFeeRates()` surfaces this as `CURRENCY_CONVERSION_FEE`; `estimateFee()` includes it in the total so strategies can subtract round-trip costs before deciding to enter.
- **No order-stream WebSocket.** `watchOrders` is implemented by polling `/api/v0/equity/history/orders` once per minute (matching Trading212's documented rate limit). Latency therefore equals the poll interval; fills arrive within ~60 seconds rather than push-style.

**Resources:**

- [Trading212 API Documentation](https://docs.trading212.com/api)
- [Trading212 Help Centre — Fees](https://helpcentre.trading212.com/hc/en-us/articles/11471996799517)
