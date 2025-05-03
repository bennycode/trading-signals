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
    iqr.update(new Big(v), false);
  }

  const result = iqr.update(new Big(values.at(-1)!), false);
  expect(result?.eq(88)).toBe(true);
});

// ✅ Good: All values are passed in clearly, and the expected IQR value is asserted directly,
// making the test easier to understand and maintain.
it('correctly calculates the IQR', () => {
  const values = [7, 7, 31, 31, 47, 75, 87, 115, 116, 119, 119, 155, 177];
  const iqr = new IQR(13);

  for (const value of values) {
    iqr.add(new Big(value));
  }

  expect(iqr.getResultOrThrow().valueOf()).toBe('88');
});
```

In test cases, prefer using the convenience methods `add(new Big(i))` instead of `update(new Big(i), false)` and `replace(new Big(i))` instead of `update(new Big(i), true)`:

```ts
// ❌ Bad: Using `update` directly
it('returns null until enough values are provided', () => {
  const iqr = new IQR(5);

  for (let i = 0; i < 4; i++) {
    const result = iqr.update(new Big(i), false);
    expect(result).toBeNull();
  }
});

// ✅ Good: Using `add` for clarity and intent
it('returns null until enough values are provided', () => {
  const iqr = new IQR(5);

  for (let i = 0; i < 4; i++) {
    const result = iqr.add(new Big(i));
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
