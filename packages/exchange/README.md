# @typedtrader/exchange

Utilities for handling trading exchange data with proper type safety and aggregation.

## Features

- **Candle Batching:** Aggregates multiple exchange candles into larger timeframes
- **Type Safety:** Zod schemas for runtime validation of exchange data
- **High Precision:** Uses `big.js` for arbitrary-precision decimal arithmetic
- **Event-Driven:** Built-in EventEmitter for streaming candle updates
- **Flexible Intervals:** Timeframes using human-readable strings (e.g., "1h", "5m")

## Design Decisions

The `Exchange` interface is intentionally kept generic so that any exchange can implement it. This means:

- **No exchange-specific order types.** Features like `stop_limit` or `trailing_stop` are available on some exchanges (e.g. Alpaca) but not others. Instead of leaking exchange-specific concepts into the shared interface, these behaviors should be replicated in the trading-strategy layer. This keeps the boundary clean and portable.
- **No order modification (patch/replace).** Some exchanges support modifying an existing order in-place. This can always be substituted with a cancellation followed by a new order placement, which works universally across all exchanges.
- **Only `MARKET` and `LIMIT` order types.** These are the two primitives supported by virtually every exchange, making them the right abstraction level for this package.

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
