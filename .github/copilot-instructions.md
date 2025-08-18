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
