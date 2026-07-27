# Change Log

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.0](https://github.com/bennycode/trading-signals/compare/trading-signals-docs@1.4.0...trading-signals-docs@2.0.0) (2026-07-24)

### ⚠ BREAKING CHANGES

- **trading-signals:** configurable signal thresholds + named StochasticOscillator config (#1215)

### Features

- **@typedtrader/messaging:** Add live trading ([#993](https://github.com/bennycode/trading-signals/issues/993))
- **candles:** add URTH 2022 bear-market dataset ([#1133](https://github.com/bennycode/trading-signals/issues/1133))
- **exchange, trading-strategies, messaging:** Add strategy onMessage event ([#1063](https://github.com/bennycode/trading-signals/issues/1063))
- **exchange, trading-strategies, messaging:** auto-remove strategy after kill switch exits ([#1056](https://github.com/bennycode/trading-signals/issues/1056))
- **exchange:** Add Trading212 broker integration ([#1073](https://github.com/bennycode/trading-signals/issues/1073))
- **exchange:** strategy warm-up hook from historical candles ([#1124](https://github.com/bennycode/trading-signals/issues/1124))
- **messaging, trading-strategies, exchange, trading-signals-docs:** pino logging, ProtectedStrategy improvements, and docs schema reference ([#1050](https://github.com/bennycode/trading-signals/issues/1050))
- **messaging:** camelCase command names with case-insensitive matching ([#1046](https://github.com/bennycode/trading-signals/issues/1046))
- **trading-signals-docs:** Add Backtesting ([#977](https://github.com/bennycode/trading-signals/issues/977))
- **trading-signals-docs:** add Chandelier Exit demo ([#1228](https://github.com/bennycode/trading-signals/issues/1228))
- **trading-signals-docs:** add demos for the eleven new indicators ([#1225](https://github.com/bennycode/trading-signals/issues/1225))
- **trading-signals-docs:** Add responsive mobile menu toggle to site navigation bar
- **trading-signals-docs:** Display opening times
- **trading-signals, trading-signals-docs:** add percentage utilities and calculator-style docs ([#1087](https://github.com/bennycode/trading-signals/issues/1087))
- **trading-signals:** Add signals for bands ([#961](https://github.com/bennycode/trading-signals/issues/961))
- **trading-signals:** add swing-point and stop-level indicators ([#1053](https://github.com/bennycode/trading-signals/issues/1053))
- **trading-signals:** Add volume indicator category ([#1034](https://github.com/bennycode/trading-signals/issues/1034))
- **trading-signals:** configurable signal thresholds + named StochasticOscillator config ([#1215](https://github.com/bennycode/trading-signals/issues/1215))
- **trading-signals:** convert ESLint configs to native TypeScript ([#1195](https://github.com/bennycode/trading-signals/issues/1195))
- **trading-strategies, trading-signals-docs:** add TrailingStopStrategy ([#1062](https://github.com/bennycode/trading-signals/issues/1062))
- **trading-strategies, trading-signals-docs:** ProtectedStrategy rollout + backtester protection modal ([#1047](https://github.com/bennycode/trading-signals/issues/1047))
- **trading-strategies:** add configurable SMA crossover strategy ([#1186](https://github.com/bennycode/trading-signals/issues/1186))
- **trading-strategies:** Add MeanReversionStrategy ([#1030](https://github.com/bennycode/trading-signals/issues/1030))
- **trading-strategies:** Add MultiIndicatorConfluenceStrategy ([#972](https://github.com/bennycode/trading-signals/issues/972))

### Bug Fixes

- **trading-signals-docs:** preserve strategy config when switching market condition ([#1187](https://github.com/bennycode/trading-signals/issues/1187))
- **trading-signals-docs:** Remove basePath/assetPrefix for root domain deployment ([#1033](https://github.com/bennycode/trading-signals/issues/1033))

# [1.4.0](https://github.com/bennycode/trading-signals/compare/trading-signals-docs@1.3.4...trading-signals-docs@1.4.0) (2026-01-21)

### Features

- **trading-signals-docs:** Add selector for market condition ([#927](https://github.com/bennycode/trading-signals/issues/927)) ([47d48fb](https://github.com/bennycode/trading-signals/commit/47d48fbce07df7d762e0f80be4ae91b43b191981))
- **trading-signals-docs:** Update design for Trend indicators ([#928](https://github.com/bennycode/trading-signals/issues/928)) ([d2aee29](https://github.com/bennycode/trading-signals/commit/d2aee292a3b939cc436d563d3e295d9c26b52560))

## [1.3.4](https://github.com/bennycode/trading-signals/compare/trading-signals-docs@1.3.3...trading-signals-docs@1.3.4) (2025-12-31)

**Note:** Version bump only for package trading-signals-docs

## [1.3.3](https://github.com/bennycode/trading-signals/compare/trading-signals-docs@1.3.2...trading-signals-docs@1.3.3) (2025-12-31)

### Bug Fixes

- Sync publication flow ([e5d27e9](https://github.com/bennycode/trading-signals/commit/e5d27e97f79cc677fb14caaad3e9352f61132374))

## [1.3.2](https://github.com/bennycode/trading-signals/compare/trading-signals-docs@1.3.1...trading-signals-docs@1.3.2) (2025-12-31)

**Note:** Version bump only for package trading-signals-docs

## [1.3.1](https://github.com/bennycode/trading-signals/compare/trading-signals-docs@1.3.0...trading-signals-docs@1.3.1) (2025-12-31)

**Note:** Version bump only for package trading-signals-docs

# [1.3.0](https://github.com/bennycode/trading-signals/compare/trading-signals-docs@1.1.0...trading-signals-docs@1.3.0) (2025-12-31)

### Features

- **@typedtrader/exchange:** Add CandleBatcher ([#907](https://github.com/bennycode/trading-signals/issues/907)) ([712baff](https://github.com/bennycode/trading-signals/commit/712baff5bf622c211d03b727182669f073ceecdf))
- **exchange:** Add Alpaca support ([#913](https://github.com/bennycode/trading-signals/issues/913)) ([c9f49f1](https://github.com/bennycode/trading-signals/commit/c9f49f15b928a2750b75a96b9a2069924c52a206))

# [1.2.0](https://github.com/bennycode/trading-signals/compare/trading-signals-docs@1.1.0...trading-signals-docs@1.2.0) (2025-12-31)

### Features

- **@typedtrader/exchange:** Add CandleBatcher ([#907](https://github.com/bennycode/trading-signals/issues/907)) ([712baff](https://github.com/bennycode/trading-signals/commit/712baff5bf622c211d03b727182669f073ceecdf))
- **exchange:** Add Alpaca support ([#913](https://github.com/bennycode/trading-signals/issues/913)) ([c9f49f1](https://github.com/bennycode/trading-signals/commit/c9f49f15b928a2750b75a96b9a2069924c52a206))

# [1.1.0](https://github.com/bennycode/trading-signals/compare/trading-signals-docs@1.0.1...trading-signals-docs@1.1.0) (2025-12-10)

### Features

- **MOM:** Add signaling ([#904](https://github.com/bennycode/trading-signals/issues/904)) ([6818395](https://github.com/bennycode/trading-signals/commit/6818395c96727c7837803acef3946f275de26de2))
- **trading-strategies:** Add Trading Strategies ([#906](https://github.com/bennycode/trading-signals/issues/906)) ([a2abe54](https://github.com/bennycode/trading-signals/commit/a2abe54961ba80af633483c236e4160a5c4e0e03))

## 1.0.1 (2025-12-02)

**Note:** Version bump only for package trading-signals-docs
