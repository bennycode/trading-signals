# Change Log

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.5.0](https://github.com/bennycode/trading-signals/compare/@typedtrader/messaging@0.4.0...@typedtrader/messaging@0.5.0) (2026-07-24)

### Features

- **@typedtrader/messaging:** Add live trading ([#993](https://github.com/bennycode/trading-signals/issues/993))
- **@typedtrader/messaging:** Allow messages only from owners ([#980](https://github.com/bennycode/trading-signals/issues/980))
- **@typedtrader/messaging:** Display diff when alert price is hit
- **exchange, trading-strategies, messaging:** Add strategy onMessage event ([#1063](https://github.com/bennycode/trading-signals/issues/1063))
- **exchange, trading-strategies, messaging:** auto-remove strategy after kill switch exits ([#1056](https://github.com/bennycode/trading-signals/issues/1056))
- **exchange:** Add Trading212 broker integration ([#1073](https://github.com/bennycode/trading-signals/issues/1073))
- **exchange:** Enforce 1-minute candle type for strategies ([#1006](https://github.com/bennycode/trading-signals/issues/1006))
- **messaging, trading-strategies, exchange, trading-signals-docs:** pino logging, ProtectedStrategy improvements, and docs schema reference ([#1050](https://github.com/bennycode/trading-signals/issues/1050))
- **messaging, trading-strategies:** Improve Telegram report delivery ([#1037](https://github.com/bennycode/trading-signals/issues/1037))
- **messaging, trading-strategies:** wizards, list tables, NoopStrategy
- **messaging:** Abstract messaging to support XMTP and Telegram ([#997](https://github.com/bennycode/trading-signals/issues/997))
- **messaging:** add /accountEdit command to update API credentials ([#1081](https://github.com/bennycode/trading-signals/issues/1081))
- **messaging:** Add /buyMarket, /sellMarket, /buyLimit, /sellLimit w… ([#1041](https://github.com/bennycode/trading-signals/issues/1041))
- **messaging:** Add /health command ([#1032](https://github.com/bennycode/trading-signals/issues/1032))
- **messaging:** add /strategyCopy command ([#1074](https://github.com/bennycode/trading-signals/issues/1074))
- **messaging:** Add account management ([#934](https://github.com/bennycode/trading-signals/issues/934))
- **messaging:** add log rotation via pino-roll ([#1051](https://github.com/bennycode/trading-signals/issues/1051))
- **messaging:** camelCase command names with case-insensitive matching ([#1046](https://github.com/bennycode/trading-signals/issues/1046))
- **messaging:** Don't process messages that were sent when being offline
- **messaging:** notify owner when strategies and watches start ([#1085](https://github.com/bennycode/trading-signals/issues/1085))
- **messaging:** run scheduled reports immediately on creation ([#1048](https://github.com/bennycode/trading-signals/issues/1048))
- **messaging:** support Trading212 in /accountAdd via a referenced data source ([#1088](https://github.com/bennycode/trading-signals/issues/1088))
- **messaging:** Update to XMTP Agent SDK v2 ([#933](https://github.com/bennycode/trading-signals/issues/933))
- **messenger:** Add /price ([#938](https://github.com/bennycode/trading-signals/issues/938))
- **messenger:** Add /watch command ([#939](https://github.com/bennycode/trading-signals/issues/939))
- **trading-signals:** convert ESLint configs to native TypeScript ([#1195](https://github.com/bennycode/trading-signals/issues/1195))
- **trading-strategies, exchange, messaging:** add S&P 500 heatmap report ([#1049](https://github.com/bennycode/trading-signals/issues/1049))
- **trading-strategies, messaging:** Add Scalp Scanner ([#1035](https://github.com/bennycode/trading-signals/issues/1035))
- **trading-strategies:** Add S&P500 ranking for Jegadeesh and Titman’s seminal paper ([#1000](https://github.com/bennycode/trading-signals/issues/1000))

### Bug Fixes

- **@typedtrader/messaging:** Fix timestamp comparison in candle watcher ([#982](https://github.com/bennycode/trading-signals/issues/982))
- **exchange, messaging:** kill-switch race + stock precision + fill order ID ([#1060](https://github.com/bennycode/trading-signals/issues/1060))
- **messaging, trading-strategies:** bind scheduled reports to an account ([#1086](https://github.com/bennycode/trading-signals/issues/1086))
- **messaging:** Deploy Meta data
- **messaging:** Deploy Meta data
- **messaging:** Fix module resolution problem
- **messaging:** harden Telegram ([#1078](https://github.com/bennycode/trading-signals/issues/1078))
- **messaging:** persist report lastRunAt so schedules survive restarts
- **messaging:** Receive platform info for Telegram
- **messaging:** run production worker without tsx watch ([#1128](https://github.com/bennycode/trading-signals/issues/1128))
- **messaging:** stop and alert the user on unrecoverable strategy errors ([#1100](https://github.com/bennycode/trading-signals/issues/1100))
- **messaging:** use index in strategyAdd callback_data
- **messaging:** use persisted config when running scheduled reports ([#1052](https://github.com/bennycode/trading-signals/issues/1052))
- **messaging:** wizard cancel/pivot, parallel conversations, no secrets in logs

# [0.4.0](https://github.com/bennycode/trading-signals/compare/@typedtrader/messaging@0.3.4...@typedtrader/messaging@0.4.0) (2026-01-21)

### Features

- **messaging:** Add /help command ([#926](https://github.com/bennycode/trading-signals/issues/926)) ([3041d22](https://github.com/bennycode/trading-signals/commit/3041d224afa611ffcad56ba11bb5f937af30b614))

## [0.3.4](https://github.com/bennycode/trading-signals/compare/@typedtrader/messaging@0.3.3...@typedtrader/messaging@0.3.4) (2025-12-31)

**Note:** Version bump only for package @typedtrader/messaging

## [0.3.3](https://github.com/bennycode/trading-signals/compare/@typedtrader/messaging@0.3.2...@typedtrader/messaging@0.3.3) (2025-12-31)

### Bug Fixes

- Sync publication flow ([e5d27e9](https://github.com/bennycode/trading-signals/commit/e5d27e97f79cc677fb14caaad3e9352f61132374))

## [0.3.2](https://github.com/bennycode/trading-signals/compare/@typedtrader/messaging@0.3.1...@typedtrader/messaging@0.3.2) (2025-12-31)

**Note:** Version bump only for package @typedtrader/messaging

## [0.3.1](https://github.com/bennycode/trading-signals/compare/@typedtrader/messaging@0.3.0...@typedtrader/messaging@0.3.1) (2025-12-31)

**Note:** Version bump only for package @typedtrader/messaging

# 0.3.0 (2025-12-31)

### Features

- **exchange:** Add Alpaca support ([#913](https://github.com/bennycode/trading-signals/issues/913)) ([c9f49f1](https://github.com/bennycode/trading-signals/commit/c9f49f15b928a2750b75a96b9a2069924c52a206))

# 0.2.0 (2025-12-31)

### Features

- **exchange:** Add Alpaca support ([#913](https://github.com/bennycode/trading-signals/issues/913)) ([c9f49f1](https://github.com/bennycode/trading-signals/commit/c9f49f15b928a2750b75a96b9a2069924c52a206))
