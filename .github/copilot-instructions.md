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
  const values = [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177];
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
  const values = [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177];
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
export class IQR extends BigIndicatorSeries<BigSource> {}

// ✅ Good: Rely on the default generic
export class IQR extends BigIndicatorSeries {}
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
// ❌ Bad: Missing const assertions, so "expected" can be mutated (values shifted)
it('calculates the intercept values correctly', () => {
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ];
  const expected = [
    '81.230',
    '81.754',
    '83.076',
    '83.076',
    '83.084',
    '82.952',
    '83.104',
    '83.778',
    '84.202',
    '84.582',
    '85.854',
  ];

  const period = 5;
  const offset = period - 1;
  const linreg = new FasterLinearRegression(period);

  for (let i = 0; i < prices.length; i++) {
    linreg.add(prices[i]);
    if (i >= offset) {
      const result = linreg.getResultOrThrow();
  expect(result.intercept.toFixed(3)).toBe(expected.shift());
    }
  }
});

// ✅ Good: Use readonly arrays and match results using an "offset"
it('calculates the intercept values correctly', () => {
  const prices = [
    81.59, 81.06, 82.87, 83.0, 83.61, 83.15, 82.84, 83.99, 84.55, 84.36, 85.53, 86.54, 86.89, 87.77, 87.29,
  ] as const;
  const expected = [
    '81.230',
    '81.754',
    '83.076',
    '83.076',
    '83.084',
    '82.952',
    '83.104',
    '83.778',
    '84.202',
    '84.582',
    '85.854',
  ] as const;

  const period = 5;
  const offset = period - 1;
  const linreg = new FasterLinearRegression(period);

  prices.forEach((price, index) => {
    linreg.add(price);
    if (index >= offset) {
      const result = linreg.getResultOrThrow();
  expect(result.intercept.toFixed(3)).toBe(expected[index - offset]);
    }
  });
});
```
