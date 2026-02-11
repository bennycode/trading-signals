# @typedtrader/exchange

Utilities for handling trading exchange data with proper type safety and aggregation.

## Features

- **Candle Batching:** Aggregates multiple exchange candles into larger timeframes
- **Type Safety:** Zod schemas for runtime validation of exchange data
- **High Precision:** Uses `big.js` for arbitrary-precision decimal arithmetic
- **Event-Driven:** Built-in EventEmitter for streaming candle updates
- **Flexible Intervals:** Timeframes using human-readable strings (e.g., "1h", "5m")

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
