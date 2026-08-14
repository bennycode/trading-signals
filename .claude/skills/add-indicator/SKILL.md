---
name: add-indicator
description: Guide for implementing technical indicators in the trading-signals package by reusing the shared base classes, utilities, and test infrastructure, and by verifying results against well-known reference implementations (Tulip Indicators, TA-Lib, Skender). Use when asked to add, implement, or port an indicator.
---

# Add an Indicator

The step-by-step recipe and all coding conventions live in `packages/trading-signals/CLAUDE.md` and are the authority. This skill covers the three things that make an implementation land on the first review: reuse the base classes, reuse the test infrastructure, and verify against a well-known reference.

## Reuse the base classes

Do not hand-roll result caching, signal tracking, or overbought/oversold logic. Read `packages/trading-signals/src/base/Indicator.ts` and extend the smallest base class that fits: each class's JSDoc states which indicator shape it serves, and that file is the current inventory (new bases get added as indicator families grow, so trust the file over any list written down elsewhere).

Before writing helper math, check the categorized utilities under `packages/trading-signals/src/util/` and reach for existing indicators as internal components instead of reimplementing them. If your indicator computes something two other indicators already compute, extract or reuse a shared helper rather than adding a third copy.

## Reuse the test infrastructure

Register the shared contract fixture once, at top level of your test file. It covers the warm-up contract (unstable, `getResult()` returns null, `getResultOrThrow()` throws `NotEnoughDataError`) and proves that `replace()` restores the exact state of an add-only series, so you never write those tests by hand:

```ts
import {testIndicatorContract} from '../../fixtures/testIndicatorContract.js';

testIndicatorContract({
  create: () => new MOM(5),
  divergentInput: 1_000,
  inputs: [81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84],
});
```

On top of the fixture, add what only you can know: a reference-data test (next section), a bidirectional `replace()` test with exact values, one test per signal state the indicator can emit, and behavioral edge cases so a mutated comparison operator fails the suite. Coverage thresholds are 100% across all metrics and fail the build; the review process also runs mutation testing against your tests.

## Verify against a well-known reference

Every indicator must reproduce published reference values. Sources in order of preference:

1. [Tulip Indicators](https://tulipindicators.org/) test data: [`untest.txt` (v0.9.1)](https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt). Match to three decimals, link the exact lines in a test comment, and tag the test with `{tags: ['tulipindicators']}`.
2. [TA-Lib](https://ta-lib.org/): match emissions bar-for-bar against the [`ta_func` C sources](https://github.com/TA-Lib/ta-lib/tree/main/src/ta_func), including the lookback. Preferred for Ehlers-style indicators that Tulip does not ship.
3. [Skender.Stock.Indicators](https://github.com/DaveSkender/Stock.Indicators): usable for pure-window math only. Its EMA-style recursions seed from an SMA while this library seeds from the first input, so smoothed series do not transfer.
4. No reference available: derive expected values by hand with exact fractions, show the derivation in a comment, and add property tests.

Two recurring pitfalls when matching references:

- Rounding ties: values printed by C can differ from JavaScript `toFixed` in the last digit when the true result sits exactly half-way (for example 84.4575). Keep the value this library computes and document the tie in the fixture comment; never loosen the assertion precision to hide it.
- Dead markets: some references emit NaN or a fabricated direction on flat input. This library never fabricates a directional signal (see the convention in CLAUDE.md); document any deviation from the reference in a comment where it occurs.

## Check your work locally

From `packages/trading-signals/`: `npx vitest run --dir src/<category>/<CODE>` (one `--dir` per invocation), then `npx tsc --noEmit`. From the repo root: `npm test` (includes knip and the 100% coverage gates) and `npm run lint`.
