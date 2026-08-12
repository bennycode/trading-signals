# Tests must kill mutants

A test only counts if it can fail. When writing or reviewing a test, mentally mutate the code under test — invert a comparison, delete a branch, hardcode a return value — and check that at least one assertion fails. If every assertion holds with the mutation in place, the test is decoration, not protection.

Real example from this repo: a test claimed zero-volume candles are included when batching, but placed the zero-volume candle in the _middle_ of the interval — where it changes neither OHLC extremes, nor volume, nor the weighted median. The test passed identically with the inclusion logic removed. The fix was repositioning the fixture so the behavior became observable: the zero-volume candle _closes_ the interval, so removing the logic means no batch is emitted and the first assertion fails.

```ts
// ❌ Bad: asserts values that are identical with and without the code under test
// ✅ Good: fixture arranged so the tested behavior visibly changes the outcome
```

## Verify with Stryker

Mutation testing is set up in `@typedtrader/exchange` (config: `stryker.config.json`):

```sh
npm run test:mutation                                   # full package
npx stryker run --mutate src/candle/CandleBatcher.ts    # scoped to one file
```

The HTML report lands in `reports/mutation/mutation.html`; surviving mutants are the test gaps. Incremental mode keeps re-runs fast.

## For reviewers

- Flag assertions that would still pass if the change under review were reverted — name the mutation that survives.
- When a test's discriminating power is unclear, suggest a scoped mutation run on the file under test instead of guessing.
