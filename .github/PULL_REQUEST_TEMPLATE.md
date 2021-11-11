<!--
Thanks for your contribution!
Please check the following to make sure your contribution follows our guideline when adding a new indicator.
-->

## Checklist

- [ ] New indicator has been implemented by extending `BigIndicatorSeries` ([Example](https://github.com/bennycode/trading-signals/pull/355/files))
- [ ] A "faster" version of this indicator has been implemented by extending `NumberIndicatorSeries` ([Example](https://github.com/bennycode/trading-signals/pull/356/files))
- [ ] Tests for `getResult` have been added for both indicators (standard & faster version) ([Example](https://github.com/bennycode/trading-signals/pull/356/files))
- [ ] Tests for error throwing when there is not enough input data have been added for both indicators (standard & faster version) ([Example](https://github.com/bennycode/trading-signals/pull/356/files))
- [ ] Tests for highest and lowest result caching have been added for both indicators (standard & faster version) ([Example](https://github.com/bennycode/trading-signals/pull/356/files))
- [ ] Indicators (standard & faster version) are exposed in `index.ts` file ([Example](https://github.com/bennycode/trading-signals/commit/2e7e5447125376c93b0a81c2d546b5f1debe1879))
- [ ] Indicators (standard & faster version) are added to `startBenchmark.ts` ([Example](https://github.com/bennycode/trading-signals/pull/350/files))
