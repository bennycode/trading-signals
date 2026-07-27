# Change Log

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.4.0](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.3.5...trading-strategies@0.4.0) (2026-07-24)

### Features

- **@typedtrader/messaging:** Add live trading ([#993](https://github.com/bennycode/trading-signals/issues/993))
- **exchange, trading-strategies, messaging:** Add strategy onMessage event ([#1063](https://github.com/bennycode/trading-signals/issues/1063))
- **exchange, trading-strategies, messaging:** auto-remove strategy after kill switch exits ([#1056](https://github.com/bennycode/trading-signals/issues/1056))
- **exchange:** Add Trading212 broker integration ([#1073](https://github.com/bennycode/trading-signals/issues/1073))
- **exchange:** Enforce 1-minute candle type for strategies ([#1006](https://github.com/bennycode/trading-signals/issues/1006))
- **messaging, trading-strategies, exchange, trading-signals-docs:** pino logging, ProtectedStrategy improvements, and docs schema reference ([#1050](https://github.com/bennycode/trading-signals/issues/1050))
- **messaging, trading-strategies:** Improve Telegram report delivery ([#1037](https://github.com/bennycode/trading-signals/issues/1037))
- **messaging, trading-strategies:** wizards, list tables, NoopStrategy
- **messaging:** support Trading212 in /accountAdd via a referenced data source ([#1088](https://github.com/bennycode/trading-signals/issues/1088))
- **messenger:** Add /watch command ([#939](https://github.com/bennycode/trading-signals/issues/939))
- **trading-signals-docs:** Add Backtesting ([#977](https://github.com/bennycode/trading-signals/issues/977))
- **trading-signals:** convert ESLint configs to native TypeScript ([#1195](https://github.com/bennycode/trading-signals/issues/1195))
- **trading-strategies, exchange, messaging:** add S&P 500 heatmap report ([#1049](https://github.com/bennycode/trading-signals/issues/1049))
- **trading-strategies, messaging:** Add Scalp Scanner ([#1035](https://github.com/bennycode/trading-signals/issues/1035))
- **trading-strategies, trading-signals-docs:** add TrailingStopStrategy ([#1062](https://github.com/bennycode/trading-signals/issues/1062))
- **trading-strategies, trading-signals-docs:** ProtectedStrategy rollout + backtester protection modal ([#1047](https://github.com/bennycode/trading-signals/issues/1047))
- **trading-strategies:** add configurable SMA crossover strategy ([#1186](https://github.com/bennycode/trading-signals/issues/1186))
- **trading-strategies:** Add GuardedStrategy base class with stop-loss and take-profit kill switches ([#1040](https://github.com/bennycode/trading-signals/issues/1040))
- **trading-strategies:** Add MeanReversionStrategy ([#1030](https://github.com/bennycode/trading-signals/issues/1030))
- **trading-strategies:** Add MultiIndicatorConfluenceStrategy ([#972](https://github.com/bennycode/trading-signals/issues/972))
- **trading-strategies:** Add S&P500 ranking for Jegadeesh and Titman’s seminal paper ([#1000](https://github.com/bennycode/trading-signals/issues/1000))
- **trading-strategies:** add volatility trailing-stop utils ([#1126](https://github.com/bennycode/trading-signals/issues/1126))
- **trading-strategies:** anchor S&P 500 momentum to exchange time and add rank deltas ([#1135](https://github.com/bennycode/trading-signals/issues/1135))
- **trading-strategies:** emit onMessage on TrailingStopStrategy peak ratchet ([#1072](https://github.com/bennycode/trading-signals/issues/1072))
- **trading-strategies:** fingerprint the momentum report result ([#1140](https://github.com/bennycode/trading-signals/issues/1140))
- **trading-strategies:** Render Top Picks for Scalping as monospace table ([#1038](https://github.com/bennycode/trading-signals/issues/1038))
- **trading-strategies:** tag strategies with market types ([#1064](https://github.com/bennycode/trading-signals/issues/1064))

### Bug Fixes

- **messaging, trading-strategies:** bind scheduled reports to an account ([#1086](https://github.com/bennycode/trading-signals/issues/1086))
- **messaging:** run production worker without tsx watch ([#1128](https://github.com/bennycode/trading-signals/issues/1128))
- **trading-strategies:** auto-remove a trailing stop when its position is gone ([#1139](https://github.com/bennycode/trading-signals/issues/1139))
- **trading-strategies:** declare ms as a runtime dependency ([#1202](https://github.com/bennycode/trading-signals/issues/1202))
- **trading-strategies:** remove 12m Ago column and rename Now to Price in S&P 500 Momentum report ([#1044](https://github.com/bennycode/trading-signals/issues/1044))
- **trading-strategies:** Share TELEGRAM_TABLE_NAME_MAX across reports ([#1042](https://github.com/bennycode/trading-signals/issues/1042))
- **trading-strategies:** trailing stop guards all available size ([#1119](https://github.com/bennycode/trading-signals/issues/1119))

## [0.3.5](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.3.4...trading-strategies@0.3.5) (2026-01-21)

**Note:** Version bump only for package trading-strategies

## [0.3.4](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.3.3...trading-strategies@0.3.4) (2025-12-31)

**Note:** Version bump only for package trading-strategies

## [0.3.3](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.3.2...trading-strategies@0.3.3) (2025-12-31)

### Bug Fixes

- Sync publication flow ([e5d27e9](https://github.com/bennycode/trading-signals/commit/e5d27e97f79cc677fb14caaad3e9352f61132374))

## [0.3.2](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.3.1...trading-strategies@0.3.2) (2025-12-31)

**Note:** Version bump only for package trading-strategies

## [0.3.1](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.3.0...trading-strategies@0.3.1) (2025-12-31)

**Note:** Version bump only for package trading-strategies

# [0.3.0](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.1.0...trading-strategies@0.3.0) (2025-12-31)

### Features

- **@typedtrader/exchange:** Add CandleBatcher ([#907](https://github.com/bennycode/trading-signals/issues/907)) ([712baff](https://github.com/bennycode/trading-signals/commit/712baff5bf622c211d03b727182669f073ceecdf))
- **exchange:** Add Alpaca support ([#913](https://github.com/bennycode/trading-signals/issues/913)) ([c9f49f1](https://github.com/bennycode/trading-signals/commit/c9f49f15b928a2750b75a96b9a2069924c52a206))

# [0.2.0](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.1.0...trading-strategies@0.2.0) (2025-12-31)

### Features

- **@typedtrader/exchange:** Add CandleBatcher ([#907](https://github.com/bennycode/trading-signals/issues/907)) ([712baff](https://github.com/bennycode/trading-signals/commit/712baff5bf622c211d03b727182669f073ceecdf))
- **exchange:** Add Alpaca support ([#913](https://github.com/bennycode/trading-signals/issues/913)) ([c9f49f1](https://github.com/bennycode/trading-signals/commit/c9f49f15b928a2750b75a96b9a2069924c52a206))

# 0.1.0 (2025-12-10)

### Features

- **trading-strategies:** Add Trading Strategies ([#906](https://github.com/bennycode/trading-signals/issues/906)) ([a2abe54](https://github.com/bennycode/trading-signals/commit/a2abe54961ba80af633483c236e4160a5c4e0e03))
