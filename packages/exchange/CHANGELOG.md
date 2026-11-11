# Change Log

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.4.0](https://github.com/bennycode/trading-signals/compare/%40typedtrader%2Fexchange%400.3.3...%40typedtrader%2Fexchange%400.4.0) (2026-11-11)

### Features

- **@typedtrader/exchange-cli:** report the venue, tradability and fractions of an instrument ([#1363](https://github.com/bennycode/trading-signals/issues/1363)) ([157c6cd](https://github.com/bennycode/trading-signals/commit/157c6cd8983b49f8346181464fc1919e98a9c9b3))
- **@typedtrader/exchange:** add a broker CLI ([#1355](https://github.com/bennycode/trading-signals/issues/1355)) ([096c410](https://github.com/bennycode/trading-signals/commit/096c41038eaba9528b6de09a8eb1815b9d18effa))
- **@typedtrader/exchange:** pick the Alpaca data feed from the account's subscription ([#1375](https://github.com/bennycode/trading-signals/issues/1375)) ([3710cc5](https://github.com/bennycode/trading-signals/commit/3710cc56caaa82f4bc3b43a7b23944890f1e0954))
- **exchange:** configurable slippage in BrokerMock ([#1279](https://github.com/bennycode/trading-signals/issues/1279)) ([280e3e5](https://github.com/bennycode/trading-signals/commit/280e3e5183403156c0534659faf8c7070d904233))
- **trading-signals-vocs:** add Vocs documentation site with interactive demos and backtesting ([#1318](https://github.com/bennycode/trading-signals/issues/1318)) ([2331df3](https://github.com/bennycode/trading-signals/commit/2331df355467d549fd56e8c80f818e9c4463c049))

### Bug Fixes

- **@typedtrader/exchange:** drop a first batch that started mid-interval in CandleBatcher ([#1417](https://github.com/bennycode/trading-signals/issues/1417)) ([15dee1e](https://github.com/bennycode/trading-signals/commit/15dee1e92b4054089b3b1851f6b1d5f4ab8f335e))
- **@typedtrader/exchange:** drop the retired Pattern Day Trader warning ([#1366](https://github.com/bennycode/trading-signals/issues/1366)) ([535e938](https://github.com/bennycode/trading-signals/commit/535e938ab2b2f06099567f36e18d336443ef64c1))
- **@typedtrader/exchange:** include zero-volume candles when batching ([#1309](https://github.com/bennycode/trading-signals/issues/1309)) ([334baa7](https://github.com/bennycode/trading-signals/commit/334baa7fc9c6322b750d990b868378bd86af659d))
- **@typedtrader/exchange:** parse Alpaca cash accounts ([#1352](https://github.com/bennycode/trading-signals/issues/1352)) ([062fa10](https://github.com/bennycode/trading-signals/commit/062fa10997ef5bd49b4eeed9044fe3a04a260ac6))
- **@typedtrader/exchange:** read Alpaca market data from the regular hosts in paper mode ([#1374](https://github.com/bennycode/trading-signals/issues/1374)) ([304f340](https://github.com/bennycode/trading-signals/commit/304f340be2b582ec4fba4f06c68d0a66458a5b5e))
- **@typedtrader/exchange:** request split- and spin-off-adjusted stock bars ([#1424](https://github.com/bennycode/trading-signals/issues/1424)) ([0550403](https://github.com/bennycode/trading-signals/commit/05504034aef41ca4cd366f8d314ff02fdef81640))
- **@typedtrader/exchange:** return only finished candles from getRecentCandles ([#1415](https://github.com/bennycode/trading-signals/issues/1415)) ([06a2564](https://github.com/bennycode/trading-signals/commit/06a2564ac0c5868b6ee943c518f29143092aac83))
- **@typedtrader/exchange:** stop charging the crypto commission on stocks ([#1365](https://github.com/bennycode/trading-signals/issues/1365)) ([3cb4709](https://github.com/bennycode/trading-signals/commit/3cb4709660142fb328a43f314270e495b8411fa4))
- **@typedtrader/exchange:** stop sending "extendedHours" field for Trading212 on limit orders ([#1362](https://github.com/bennycode/trading-signals/issues/1362)) ([3dc3c5d](https://github.com/bennycode/trading-signals/commit/3dc3c5d9a555dd2cc4e69561122535e71c126bab))
- short indicator codes and missing configs in the CLI, IEX history on free Alpaca plans ([#1398](https://github.com/bennycode/trading-signals/issues/1398)) ([d654cb4](https://github.com/bennycode/trading-signals/commit/d654cb416dd44c7f07d1c053477e9b7b57fc7821))
- **trading-strategies:** call strategy init in BacktestExecutor ([#1373](https://github.com/bennycode/trading-signals/issues/1373)) ([752cc2b](https://github.com/bennycode/trading-signals/commit/752cc2b06b994ee27c4b341c06d51b8cf1f0e8bb))
- **trading-strategies:** track the position a fill actually delivered ([#1353](https://github.com/bennycode/trading-signals/issues/1353)) ([fc625a3](https://github.com/bennycode/trading-signals/commit/fc625a369546261dd4ef2c2af1b735e29cecaad4))

## [0.3.3](https://github.com/bennycode/trading-signals/compare/@typedtrader/exchange@0.3.2...@typedtrader/exchange@0.3.3) (2026-08-08)

### Bug Fixes

- **@typedtrader/exchange:** send client order ids with order placements ([#1178](https://github.com/bennycode/trading-signals/issues/1178))

## [0.3.2](https://github.com/bennycode/trading-signals/compare/@typedtrader/exchange@0.3.1...@typedtrader/exchange@0.3.2) (2026-08-02)

### Bug Fixes

- format lerna-generated changelogs via the version lifecycle ([#1268](https://github.com/bennycode/trading-signals/issues/1268))
- **trading-signals, trading-strategies, candles, exchange:** add repository metadata for npm provenance ([#1267](https://github.com/bennycode/trading-signals/issues/1267))

## [0.3.1](https://github.com/bennycode/trading-signals/compare/@typedtrader/exchange@0.3.0...@typedtrader/exchange@0.3.1) (2026-08-02)

### Bug Fixes

- **exchange:** remove console noise and dotenv-defaults from consumer install ([#1240](https://github.com/bennycode/trading-signals/issues/1240))

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
