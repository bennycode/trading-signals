<!--
Thanks for your contribution!
Please check the following to make sure your contribution follows our guideline when adding a new indicator.

You can find a great example here:
https://github.com/bennycode/trading-signals/commit/9c4a6d02bcecdde6dbe5b568c6ec547512164364
-->

## Checklist for new indicators

- [ ] Indicator is documented and implemented by extending `BigIndicatorSeries`
- [ ] A "faster" version of this indicator is implemented by extending `NumberIndicatorSeries`
- [ ] Tests for `getResult` are present
- [ ] Tests for highest and lowest result caching are present
- [ ] Tests for error handling are present (if not done in base class)
- [ ] Indicators (standard & faster version) are exposed in `src/index.ts`
- [ ] Indicators (standard & faster version) are added to `startBenchmark.ts`
- [ ] Indicator is listed in `README.md`
