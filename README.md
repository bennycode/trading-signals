# Trading Signals Monorepo

![Language Details](https://img.shields.io/github/languages/top/bennycode/trading-signals) ![Code Coverage](https://img.shields.io/codecov/c/github/bennycode/trading-signals/main) ![License](https://img.shields.io/npm/l/trading-signals.svg) ![Package Version](https://img.shields.io/npm/v/trading-signals.svg)

This monorepo contains the [**Trading Signals library**](https://www.npmjs.com/package/trading-signals) and [its documentation website](https://bennycode.com/trading-signals/). Trading Signals provides TypeScript implementations of technical indicators and overlays for algorithmic trading and technical analysis.



## 📦 Packages

This project uses [Lerna](https://lerna.js.org/) for managing the [monorepo](https://monorepo.tools/) with independent versioning. Execute `npm test` to run tests across all packages. Launch an interactive demo with `npm run docs`.

### [@typedtrader/exchange](./packages/exchange)

Data transformation utilities for handling exchange candle data with proper type safety and aggregation.

- **Candle Batching:** Aggregates multiple exchange candles into larger timeframes
- **Type Safety:** Zod schemas for runtime validation of exchange data
- **High Precision:** Uses `big.js` for arbitrary-precision decimal arithmetic
- **Event-Driven:** Built-in EventEmitter for streaming candle updates
- **Flexible Intervals:** Timeframes using human-readable strings (e.g., "1h", "5m")

### [trading-signals](./packages/trading-signals)

The core library providing technical indicators for algorithmic trading.

- **Features:** Streaming updates, replace mode, lazy evaluation, memory efficiency
- **Coverage:** 100% test coverage across all metrics
- **Bundle:** Zero runtime dependencies
- **Type Safety:** Full TypeScript with strict mode

### [trading-signals-docs](./packages/trading-signals-docs)

Documentation and showcase website built with Next.js, featuring interactive demos and examples of all indicators.

- **Visualization:** [Highcharts](https://www.highcharts.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Framework:** [Next.js](https://nextjs.org/)

### [trading-strategies](./packages/trading-strategies)

Trading strategy implementations that combine technical indicators into actionable trading signals.

- **Interface:** Consistent strategy interface for building custom strategies
- **Baseline:** Includes baseline strategies for benchmark comparisons
- **Integration:** Designed to work seamlessly with `trading-signals`
- **Type Safety:** Full TypeScript with strict mode
