Wrap variables in quotes for log clarity.

```ts
// ❌ Bad: Interpolated values blend into the message
console.log(`Account with ID ${accountId} not found`);

// ✅ Good: Quotes make variable values stand out
console.log(`Account with ID "${accountId}" not found`);
```

Avoid using "should" in test descriptions, as its constant repetition makes them tedious to read. Instead, write the description as a clear statement of what the code does.

```ts
// ❌ Bad: Describes what the code "should" do
it('should return 1 for a bullish setup', () => {});

// ✅ Good: Describes what the code "does"
it('returns 1 for a bullish setup', () => {});
```

Add blank lines before and after control statements to improve readability.

```ts
// ❌ Bad: For-statement is tied to variable declaration
const td = new TDS();
for (let i = 0; i < 5; i++) {
  td.add(i);
}

// ✅ Good: Visual space between variable declaration and for-statement
const td = new TDS();

for (let i = 0; i < 5; i++) {
  td.add(i);
}
```

Verify the exact expected value and keep tests as clear and readable as possible.

```ts
// ❌ Bad: The test slices the input array and uses a boolean condition to assert the result,
// which makes the intent less clear and harder to debug.
it('correctly calculates the IQR', () => {
  const prices = [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177];
  const iqr = new IQR(13);

  for (const v of values.slice(0, -1)) {
    iqr.update(v, false);
  }

  const result = iqr.update(values.at(-1)!, false);
  expect(result).toBe(88);
});

// ✅ Good: All values are passed in clearly, and the expected IQR value is asserted directly,
// making the test easier to understand and maintain.
it('correctly calculates the IQR', () => {
  const prices = [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177];
  const iqr = new IQR(13);

  for (const value of values) {
    iqr.add(value);
  }

  expect(iqr.getResultOrThrow()).toBe(88);
});
```

In test cases, prefer using the convenience methods `add(i)` instead of `update(i, false)` and `replace(i)` instead of `update(i, true)`:

```ts
// ❌ Bad: Using `update` directly
it('returns null until enough values are provided', () => {
  const iqr = new IQR(5);

  for (let i = 0; i < 4; i++) {
    const result = iqr.update(i, false);
    expect(result).toBeNull();
  }
});

// ✅ Good: Using `add` for clarity and intent
it('returns null until enough values are provided', () => {
  const iqr = new IQR(5);

  for (let i = 0; i < 4; i++) {
    const result = iqr.add(i);
    expect(result).toBeNull();
  }
});
```

Avoid explicitly specifying generic type parameters when a default is already provided:

```ts
// ❌ Bad: Redundant generic type argument
export class IQR extends IndicatorSeries<number> {}

// ✅ Good: Rely on the default generic
export class IQR extends IndicatorSeries {}
```

Prefer inferred return types over explicit return types to keep code cleaner and reduce duplication:

```ts
// ❌ Bad: Explicit return type
override update(data: HighLowCloseVolume, replace: boolean) { }

// ✅ Good: Let TypeScript infer the return type
override update(data: HighLowCloseVolume, replace: boolean) { }
```

Use `as const` for both test inputs and expected outputs. When looping, prefer `forEach` instead of manual index-based `for` loops:

```ts
// ❌ Bad: Missing const assertions, so "expectations" can be mutated (values shifted)
it('calculates the moving average based on the last 5 prices', () => {
  const prices = [91, 90, 89, 88, 90];
  const expectations = ['89.33'];
  const wma = new WMA(5);

  for (const price of prices) {
    const result = wma.add(price);

    if (result) {
      const expected = expectations.shift();
      expect(result.toFixed(2)).toBe(expected);
    }
  }

  expect(wma.isStable).toBe(true);
});

// ✅ Good: Use readonly arrays and match results using an "offset"
it('calculates the moving average based on the last 5 prices', () => {
  const prices = [91, 90, 89, 88, 90] as const;
  const expectations = ['89.33'] as const;
  const wma = new WMA(5);
  const offset = wma.getRequiredInputs() - 1;

  prices.forEach((price, i) => {
    const result = wma.add(price);

    if (result) {
      const expected = expectations[i - offset];
      expect(result.toFixed(2)).toBe(expected);
    }
  });

  expect(wma.isStable).toBe(true);
});
```

When testing the `replace()` method, verify bidirectional replacement by testing original vs replaced values and then restoring back to the original:

```ts
// ❌ Bad: Only tests that replace changes the value
it('can replace recently added values', () => {
  const stoch = new StochasticOscillator(5, 3, 3);

  for (let i = 0; i < 9; i++) {
    stoch.add({close: 50 + i, high: 100, low: 10});
  }

  const resultBefore = stoch.getResultOrThrow();

  stoch.add({close: 80, high: 100, low: 10});
  stoch.replace({close: 30, high: 100, low: 10});

  const resultAfter = stoch.getResultOrThrow();

  expect(resultAfter.stochK).not.toBe(resultBefore.stochK);
});

// ✅ Good: Tests replacement and restoration to verify replace functionality
it('replaces the most recently added value', () => {
  const stoch = new StochasticOscillator(5, 3, 3);

  for (let i = 0; i < 9; i++) {
    stoch.add({close: 50 + i, high: 100, low: 10});
  }

  const originalValue = {close: 80, high: 100, low: 10} as const;
  const replacedValue = {close: 30, high: 100, low: 10} as const;

  const originalResult = stoch.add(originalValue);
  const replacedResult = stoch.replace(replacedValue);

  expect(replacedResult?.stochK).not.toBe(originalResult?.stochK);

  const restoredResult = stoch.replace(originalValue);

  expect(restoredResult?.stochK).toBe(originalResult?.stochK);
});
```

Always use `setResult()` to update indicator results in inherited classes. Never assign directly to `this.result`:

```ts
// ❌ Bad: Direct assignment breaks signal tracking
override update(candle: HighLowClose<number>, replace: boolean) {
  // ... calculation logic ...
  return (this.result = calculatedValue);
}

// ✅ Good: Using setResult() properly maintains previousResult for signal tracking
override update(candle: HighLowClose<number>, replace: boolean) {
  // ... calculation logic ...
  return this.setResult(calculatedValue, replace);
}
```

# Adding a New Indicator

Reference implementation: [PR #1212 (Aroon)](https://github.com/bennycode/trading-signals/pull/1212) shows all steps end to end.

1. **Pick the category folder** — `src/momentum/`, `src/trend/`, `src/volatility/` or `src/volume/`. Create a directory named after the indicator code in uppercase, with the class file named after the exported class: `src/trend/AROON/Aroon.ts`.
2. **Extend the right base class** (`src/base/Indicator.ts`):
   - Single-number result → `IndicatorSeries` (or `TrendIndicatorSeries` for signal tracking). Use `setResult()`.
   - Multi-value result (e.g. `{aroonUp, aroonDown}`) → `TechnicalIndicator<Result, Input>`. Export the result interface. Here `this.result` is assigned directly — `setResult()` only exists on `IndicatorSeries`.
3. **Use shared building blocks** — input types from `src/base/Candle.types.ts` (`HighLow`, `HighLowClose`, …), `pushUpdate()` from `src/util/` for the sliding candle window, and existing indicators (SMA, EMA, ATR, …) as internal components instead of reimplementing them.
4. **Implement the contract** — `getRequiredInputs()` returns the warm-up count; `update(input, replace)` returns the result or `null` during warm-up. `replace()` must be correct: if the result is a pure function of the candle window, `pushUpdate()` handles it; if the indicator carries smoothing state, restore the previous state on replace.
5. **No constructor parameter properties** — the codebase compiles with `erasableSyntaxOnly`, so declare fields explicitly and assign them in the constructor.
6. **Write the class JSDoc with intent** — indicator name and code, type (Trend/Momentum/…), what it tells a trader, and `@see` links to sources (e.g. Investopedia, Tulip Indicators).
7. **Export it** — add the class to the category `index.ts` (alphabetical order) and add the indicator to the "Supported Technical Indicators" list in `README.md` (alphabetical order).
8. **Write co-located tests** (`<Name>.test.ts`, 100% coverage is enforced):
   - Verify results against external reference data. Prefer [Tulip Indicators test data](https://github.com/TulipCharts/tulipindicators/blob/v0.9.1/tests/untest.txt), link the exact lines in a comment, and tag the test with `{tags: ['tulipindicators']}`.
   - Add a single-instance bidirectional `replace()` test asserting exact values for the original, replaced and restored results.
   - Add a `NotEnoughDataError` test for `getResultOrThrow()` before warm-up.
   - Cover behavioral edge cases so a mutated comparison operator fails the suite (e.g. tie-breaking of equal extremes in Aroon).
