# Trading Signals Monorepo

This monorepo contains multiple packages for building automated trading bots, including the famous [`trading-signals`](https://www.npmjs.com/package/trading-signals) library and [its documentation website](https://bennycode.com/trading-signals/). These packages provide TypeScript implementations of technical indicators, trading strategies, and data transformation utilities for algorithmic trading.

The `trading-signals` library is tested in production and trusted by [hundreds of projects](https://github.com/bennycode/trading-signals/network/dependents) worldwide.

## 📦 Packages

This project uses [Lerna](https://lerna.js.org/) for managing the [monorepo](https://monorepo.tools/) with independent versioning. Execute `npm test` to run tests across all packages. Launch an interactive demo with `npm run docs`.

| Package | Description |
| --- | --- |
| [**@typedtrader/exchange**](./packages/exchange) | Unified exchange interface providing interoperability across different brokers (e.g., [Alpaca](https://alpaca.markets/)). Offers type-safe data transformation utilities and a streamlined API for integrating multiple exchanges and brokers into your trading applications. |
| [**@typedtrader/messaging**](./packages/messaging) | End-to-end encrypted messaging interface for controlling personal trading bots remotely via [XMTP protocol](https://xmtp.org/). Enables secure command execution and real-time trading bot interaction. |
| [**trading-signals**](./packages/trading-signals) | [Technical indicators](https://en.wikipedia.org/wiki/Technical_indicator) (SMA, EMA, RSI, MACD, ...) for algorithmic trading with streaming updates, replace mode, lazy evaluation, and memory efficiency. Can be added to your own trading apps or strategies. |
| [**trading-signals-docs**](./packages/trading-signals-docs) | Documentation and [showcase website](https://bennycode.com/trading-signals/) built with Next.js, featuring interactive demos and examples of all indicators. See every indicator in action before you code. |
| [**trading-strategies**](./packages/trading-strategies) | [Trading strategy](https://en.wikipedia.org/wiki/Trading_strategy) implementations that combine technical indicators into actionable advices. Can be used to build your own strategies for backtesting and real-time trading. |

### Deploy to Render

Deploy the `@typedtrader/messaging` package as a background worker to [Render](https://render.com/). The configuration includes persistent disk storage for the XMTP database and secure environment variable management:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/bennycode/trading-signals)
