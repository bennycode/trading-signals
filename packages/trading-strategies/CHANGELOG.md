# Change Log

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.5.0](https://github.com/bennycode/trading-signals/compare/trading-strategies%400.4.5...trading-strategies%400.5.0) (2026-11-11)

### Features

- **exchange:** configurable slippage in BrokerMock ([#1279](https://github.com/bennycode/trading-signals/issues/1279)) ([280e3e5](https://github.com/bennycode/trading-signals/commit/280e3e5183403156c0534659faf8c7070d904233))
- **trading-signals-docs:** move the trading knowledge to the website ([#1377](https://github.com/bennycode/trading-signals/issues/1377)) ([43f6425](https://github.com/bennycode/trading-signals/commit/43f642566163806bc78316a3a74305cc52e6b253))
- **trading-signals-vocs:** add Vocs documentation site with interactive demos and backtesting ([#1318](https://github.com/bennycode/trading-signals/issues/1318)) ([2331df3](https://github.com/bennycode/trading-signals/commit/2331df355467d549fd56e8c80f818e9c4463c049))
- **trading-strategies:** add BatchedIndicator to run indicators on a larger timeframe ([#1414](https://github.com/bennycode/trading-signals/issues/1414)) ([e94bf7d](https://github.com/bennycode/trading-signals/commit/e94bf7dfceb12e87c70e72f506c93e6caf12f56d))
- **trading-strategies:** add performance risk metrics ([#1316](https://github.com/bennycode/trading-signals/issues/1316)) ([62985e1](https://github.com/bennycode/trading-signals/commit/62985e1ed759e08881410bb7672b01271e6f3baf))

### Bug Fixes

- **@typedtrader/exchange:** request split- and spin-off-adjusted stock bars ([#1424](https://github.com/bennycode/trading-signals/issues/1424)) ([0550403](https://github.com/bennycode/trading-signals/commit/05504034aef41ca4cd366f8d314ff02fdef81640))
- **@typedtrader/exchange:** stop charging the crypto commission on stocks ([#1365](https://github.com/bennycode/trading-signals/issues/1365)) ([3cb4709](https://github.com/bennycode/trading-signals/commit/3cb4709660142fb328a43f314270e495b8411fa4))
- **trading-strategies:** call strategy init in BacktestExecutor ([#1373](https://github.com/bennycode/trading-signals/issues/1373)) ([752cc2b](https://github.com/bennycode/trading-signals/commit/752cc2b06b994ee27c4b341c06d51b8cf1f0e8bb))
- **trading-strategies:** serve restored state to the strategy, not just the snapshot ([#1430](https://github.com/bennycode/trading-signals/issues/1430)) ([2d0c4ee](https://github.com/bennycode/trading-signals/commit/2d0c4eeca504c1dad2c729c8b2c3e84f95fd52d2))
- **trading-strategies:** track the position a fill actually delivered ([#1353](https://github.com/bennycode/trading-signals/issues/1353)) ([fc625a3](https://github.com/bennycode/trading-signals/commit/fc625a369546261dd4ef2c2af1b735e29cecaad4))

## [0.4.5](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.4.4...trading-strategies@0.4.5) (2026-08-11)

**Note:** Version bump only for package trading-strategies

## [0.4.4](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.4.3...trading-strategies@0.4.4) (2026-08-08)

**Note:** Version bump only for package trading-strategies

## [0.4.3](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.4.2...trading-strategies@0.4.3) (2026-08-02)

**Note:** Version bump only for package trading-strategies

## [0.4.2](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.4.1...trading-strategies@0.4.2) (2026-08-02)

### Bug Fixes

- format lerna-generated changelogs via the version lifecycle ([#1268](https://github.com/bennycode/trading-signals/issues/1268))
- **trading-signals, trading-strategies, candles, exchange:** add repository metadata for npm provenance ([#1267](https://github.com/bennycode/trading-signals/issues/1267))

## [0.4.1](https://github.com/bennycode/trading-signals/compare/trading-strategies@0.4.0...trading-strategies@0.4.1) (2026-08-02)

**Note:** Version bump only for package trading-strategies

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
