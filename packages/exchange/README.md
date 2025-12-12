# @typedtrader/exchange

Utilities for handling trading exchange data with proper type safety and aggregation.

## Features

- **Candle Batching:** Aggregates multiple exchange candles into larger timeframes
- **Type Safety:** Zod schemas for runtime validation of exchange data
- **High Precision:** Uses `big.js` for arbitrary-precision decimal arithmetic
- **Event-Driven:** Built-in EventEmitter for streaming candle updates
- **Flexible Intervals:** Timeframes using human-readable strings (e.g., "1h", "5m")
