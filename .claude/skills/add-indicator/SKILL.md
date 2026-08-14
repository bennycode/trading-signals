---
name: add-indicator
description: Guide for implementing technical indicators in the trading-signals package by reusing the shared base classes, utilities, and test infrastructure, and by verifying results against well-known reference implementations (Tulip Indicators, TA-Lib, Skender). Use when asked to add, implement, or port an indicator.
---

# Add an Indicator

The step-by-step recipe and all coding conventions live in the trading-signals package's CLAUDE.md and are the authority. This skill covers the three habits that make an implementation land on the first review: reuse the base classes, reuse the test infrastructure, and verify against a well-known reference.

## Reuse the base classes

Do not hand-roll result caching, signal tracking, or overbought/oversold logic. Open any existing indicator, follow its import to the base-class module, and extend the smallest base class that fits: each class's JSDoc states which indicator shape it serves, and that module is the current inventory (new bases get added as indicator families grow, so trust the source over any list written down elsewhere).

Before writing helper math, check the shared utilities the package exports and reach for existing indicators as internal components instead of reimplementing them. If your indicator computes something two other indicators already compute, extract or reuse a shared helper rather than adding a third copy.

## Reuse the test infrastructure

Register the shared indicator contract fixture at the top level of your test file; any existing indicator test shows the registration and where the fixture lives. It covers the warm-up contract and proves that `replace()` restores the exact state of an add-only series, so those tests are never written by hand.

On top of the fixture, add only what it cannot know: a reference-data test (next section), a bidirectional `replace()` test with exact values, one test per signal state the indicator can emit, and behavioral edge cases so a mutated comparison operator fails the suite. Coverage thresholds are 100% across all metrics and fail the build; the review process also runs mutation testing against your tests.

## Verify against a well-known reference

Every indicator must reproduce published reference values, asserted exactly and with the source linked in a test comment. Sources in order of preference:

1. [Tulip Indicators](https://tulipindicators.org/): its repository ships a test data file with inputs and expected outputs for every indicator it supports. Match to three decimals and link the exact lines of the version you used.
2. [TA-Lib](https://ta-lib.org/): match emissions bar-for-bar against its [C sources](https://github.com/TA-Lib/ta-lib), including the lookback. Preferred for Ehlers-style indicators that Tulip does not ship.
3. [Skender.Stock.Indicators](https://github.com/DaveSkender/Stock.Indicators): usable for pure-window math only. Its EMA-style recursions seed from an SMA while this library seeds from the first input, so smoothed series do not transfer.
4. No reference implementation available: search the web for published test vectors first. Worked step-by-step examples often exist on [Wikipedia](https://en.wikipedia.org/), [Investopedia](https://www.investopedia.com/), or in the indicator author's original publication; a found vector beats a self-made one. Only when nothing is published, derive expected values by hand with exact fractions, show the derivation in a comment, and add property tests.
