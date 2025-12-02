# Trading Signals Monorepo

![Language Details](https://img.shields.io/github/languages/top/bennycode/trading-signals) ![Code Coverage](https://img.shields.io/codecov/c/github/bennycode/trading-signals/main) ![License](https://img.shields.io/npm/l/trading-signals.svg) ![Package Version](https://img.shields.io/npm/v/trading-signals.svg)

This monorepo contains the Trading Signals library and its documentation website. Trading Signals provides TypeScript implementations of technical indicators and overlays for algorithmic trading and technical analysis.

## 📦 Packages

This project uses [Lerna](https://lerna.js.org/) for managing the monorepo with independent versioning. Execute `npm test` to run tests across all packages. Launch an interactive demo with `npm run docs`.

### [trading-signals](./packages/trading-signals)

The core library providing technical indicators for algorithmic trading.

- **Features:** Streaming updates, replace mode, lazy evaluation, memory efficiency
- **Coverage:** 100% test coverage across all metrics
- **Bundle:** Zero runtime dependencies
- **Type Safety:** Full TypeScript with strict mode

### [trading-signals-docs](./packages/trading-signals-docs)

Documentation and showcase website built with Next.js, featuring interactive demos and examples of all indicators.

- **Framework:** [Next.js](https://nextjs.org/)
- **Visualization:** [Highcharts](https://www.highcharts.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)

## 🏷️ Keywords

algorithmic trading, technical analysis, indicators, TypeScript, JavaScript, trading signals, MACD, RSI, SMA, EMA, Bollinger Bands, moving averages, ADX, ATR, momentum, trend, volatility
