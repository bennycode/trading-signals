# Change Log

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.3.0](https://github.com/bennycode/trading-signals/compare/@typedtrader/exchange@0.2.5...@typedtrader/exchange@0.3.0) (2026-07-24)

### Features

- **@typedtrader/exchange:** Add trading session ([#965](https://github.com/bennycode/trading-signals/issues/965))
- **@typedtrader/exchange:** Extend Alpaca API ([#962](https://github.com/bennycode/trading-signals/issues/962))
- **@typedtrader/messaging:** Add live trading ([#993](https://github.com/bennycode/trading-signals/issues/993))
- **exchange, trading-strategies, messaging:** Add strategy onMessage event ([#1063](https://github.com/bennycode/trading-signals/issues/1063))
- **exchange, trading-strategies, messaging:** auto-remove strategy after kill switch exits ([#1056](https://github.com/bennycode/trading-signals/issues/1056))
- **exchange:** add isEarningsDay util backed by Finnhub ([#1055](https://github.com/bennycode/trading-signals/issues/1055))
- **exchange:** Add Trading212 broker integration ([#1073](https://github.com/bennycode/trading-signals/issues/1073))
- **exchange:** Enforce 1-minute candle type for strategies ([#1006](https://github.com/bennycode/trading-signals/issues/1006))
- **exchange:** strategy warm-up hook from historical candles ([#1124](https://github.com/bennycode/trading-signals/issues/1124))
- **messaging, trading-strategies, exchange, trading-signals-docs:** pino logging, ProtectedStrategy improvements, and docs schema reference ([#1050](https://github.com/bennycode/trading-signals/issues/1050))
- **messaging:** add /accountEdit command to update API credentials ([#1081](https://github.com/bennycode/trading-signals/issues/1081))
- **messaging:** Add account management ([#934](https://github.com/bennycode/trading-signals/issues/934))
- **messaging:** support Trading212 in /accountAdd via a referenced data source ([#1088](https://github.com/bennycode/trading-signals/issues/1088))
- **messenger:** Add /price ([#938](https://github.com/bennycode/trading-signals/issues/938))
- **messenger:** Add /watch command ([#939](https://github.com/bennycode/trading-signals/issues/939))
- **trading-signals-docs:** Add Backtesting ([#977](https://github.com/bennycode/trading-signals/issues/977))
- **trading-signals:** convert ESLint configs to native TypeScript ([#1195](https://github.com/bennycode/trading-signals/issues/1195))
- **trading-strategies, exchange, messaging:** add S&P 500 heatmap report ([#1049](https://github.com/bennycode/trading-signals/issues/1049))
- **trading-strategies, messaging:** Add Scalp Scanner ([#1035](https://github.com/bennycode/trading-signals/issues/1035))
- **trading-strategies:** Add MultiIndicatorConfluenceStrategy ([#972](https://github.com/bennycode/trading-signals/issues/972))

### Bug Fixes

- **exchange, messaging:** kill-switch race + stock precision + fill order ID ([#1060](https://github.com/bennycode/trading-signals/issues/1060))
- **exchange:** bound the Alpaca retry config ([#1082](https://github.com/bennycode/trading-signals/issues/1082))
- **exchange:** exit on market-data WebSocket close so orchestrator restarts ([#1071](https://github.com/bennycode/trading-signals/issues/1071))
- **exchange:** import node:assert in BrokerMock ([#1122](https://github.com/bennycode/trading-signals/issues/1122))
- **exchange:** remove Authorization headers from Axios errors ([#1080](https://github.com/bennycode/trading-signals/issues/1080))
- **exchange:** treat already-filled orders as successfully canceled ([#1079](https://github.com/bennycode/trading-signals/issues/1079))
- **exchange:** Update Alpaca's minimum Base size ([#1099](https://github.com/bennycode/trading-signals/issues/1099))
- **exchange:** verify Trading212 credentials against an authenticated endpoint ([#1179](https://github.com/bennycode/trading-signals/issues/1179))
- **messaging:** stop and alert the user on unrecoverable strategy errors ([#1100](https://github.com/bennycode/trading-signals/issues/1100))

## [0.2.5](https://github.com/bennycode/trading-signals/compare/@typedtrader/exchange@0.2.4...@typedtrader/exchange@0.2.5) (2026-01-21)

**Note:** Version bump only for package @typedtrader/exchange

## [0.2.4](https://github.com/bennycode/trading-signals/compare/@typedtrader/exchange@0.2.3...@typedtrader/exchange@0.2.4) (2025-12-31)

**Note:** Version bump only for package @typedtrader/exchange

## [0.2.3](https://github.com/bennycode/trading-signals/compare/@typedtrader/exchange@0.2.2...@typedtrader/exchange@0.2.3) (2025-12-31)

### Bug Fixes

- Sync publication flow ([e5d27e9](https://github.com/bennycode/trading-signals/commit/e5d27e97f79cc677fb14caaad3e9352f61132374))

## [0.2.2](https://github.com/bennycode/trading-signals/compare/@typedtrader/exchange@0.2.1...@typedtrader/exchange@0.2.2) (2025-12-31)

**Note:** Version bump only for package @typedtrader/exchange

## [0.2.1](https://github.com/bennycode/trading-signals/compare/@typedtrader/exchange@0.2.0...@typedtrader/exchange@0.2.1) (2025-12-31)

**Note:** Version bump only for package @typedtrader/exchange

# 0.2.0 (2025-12-31)

### Features

- **@typedtrader/exchange:** Add CandleBatcher ([#907](https://github.com/bennycode/trading-signals/issues/907)) ([712baff](https://github.com/bennycode/trading-signals/commit/712baff5bf622c211d03b727182669f073ceecdf))
- **exchange:** Add Alpaca support ([#913](https://github.com/bennycode/trading-signals/issues/913)) ([c9f49f1](https://github.com/bennycode/trading-signals/commit/c9f49f15b928a2750b75a96b9a2069924c52a206))

# 0.1.0 (2025-12-31)

### Features

- **@typedtrader/exchange:** Add CandleBatcher ([#907](https://github.com/bennycode/trading-signals/issues/907)) ([712baff](https://github.com/bennycode/trading-signals/commit/712baff5bf622c211d03b727182669f073ceecdf))
- **exchange:** Add Alpaca support ([#913](https://github.com/bennycode/trading-signals/issues/913)) ([c9f49f1](https://github.com/bennycode/trading-signals/commit/c9f49f15b928a2750b75a96b9a2069924c52a206))
