# Trading Signals Monorepo

This monorepo contains multiple packages for building automated trading bots, including the famous [`trading-signals`](https://www.npmjs.com/package/trading-signals) library and [its documentation website](https://bennycode.com/trading-signals/). These packages provide TypeScript implementations of technical indicators, trading strategies, and data transformation utilities for algorithmic trading and technical analysis, with core libraries distributed for general use.

The `trading-signals` library is battle-tested in production and trusted by [hundreds of projects](https://github.com/bennycode/trading-signals/network/dependents) worldwide.

## 📦 Packages

This project uses [Lerna](https://lerna.js.org/) for managing the [monorepo](https://monorepo.tools/) with independent versioning. Execute `npm test` to run tests across all packages. Launch an interactive demo with `npm run docs`.

| Package | Description |
| --- | --- |
| [**@typedtrader/exchange**](./packages/exchange) | Data transformation utilities for handling exchange candle data with proper type safety and aggregation |
| [**trading-signals**](./packages/trading-signals) | Technical indicators for algorithmic trading with streaming updates, replace mode, lazy evaluation, and memory efficiency |
| [**trading-signals-docs**](./packages/trading-signals-docs) | Documentation and showcase website built with Next.js, featuring interactive demos and examples of all indicators |
| [**trading-strategies**](./packages/trading-strategies) | Trading strategy implementations that combine technical indicators into actionable trading signals |
