# Trading Signals Monorepo

![Language Details](https://img.shields.io/github/languages/top/bennycode/trading-signals) ![Code Coverage](https://img.shields.io/codecov/c/github/bennycode/trading-signals/main) ![License](https://img.shields.io/npm/l/trading-signals.svg) ![Package Version](https://img.shields.io/npm/v/trading-signals.svg)

This monorepo contains the [**Trading Signals library**](https://www.npmjs.com/package/trading-signals) and [its documentation website](https://bennycode.com/trading-signals/). Trading Signals provides TypeScript implementations of technical indicators and overlays for algorithmic trading and technical analysis.

## Technical Analysis

[Technical analysis](https://en.wikipedia.org/wiki/Technical_analysis) turns raw price and volume data into actionable trading signals, highlighting momentum, volatility, and trend shifts before they become obvious on a chart. The [trading-signals](https://www.npmjs.com/package/trading-signals) package delivers those insights with battle-tested TypeScript code.

## Trading Strategies

Multiple signals can be combined into a single trading strategy, but the real benchmark is whether that strategy beats the market consistently. Always backtest with historical price data and compare the results against both a simple **buy-and-hold** baseline and a purely random **coin-flip model**. If your approach outperforms those in sideways, bullish, and bearish scenarios, you are heading in the right direction.

Be aware: No strategy works all the time, so build in strict loss caps, a realistic positive price target, and the discipline to accept occasional losses. Managing risk matters more than heroically “holding a falling knife,” so focus on winning more often than you lose.

## 📦 Packages

This project uses [Lerna](https://lerna.js.org/) for managing the [monorepo](https://monorepo.tools/) with independent versioning. Execute `npm test` to run tests across all packages. Launch an interactive demo with `npm run docs`.

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
