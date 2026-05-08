# Avoid `getResult()!` non-null assertion

Calling `getResult()` and asserting non-null with `!` lies about the contract — `getResult()` returns `undefined` until the indicator has warmed up, and the `!` silences the type system instead of handling the case.

```ts
// ❌ Bad: silences the type system, crashes with "Cannot read properties of undefined" if used too early
const ema = this.#ema.getResult()!;
```

Pick one of the two honest alternatives depending on what the surrounding code can do:

```ts
// ✅ Good (a): explicit undefined check when the caller can keep going without a result
const ema = this.#ema.getResult();
if (ema === undefined) {
  return; // or skip this candle, log a warning, etc.
}
useEma(ema);

// ✅ Good (b): getResultOrThrow() when a result is required and absence is a bug
const ema = this.#ema.getResultOrThrow();
```

Use (a) on a hot path that runs before the indicator has warmed up — return / skip / branch on the `undefined` instead of pretending it can't happen.

Use (b) once you've already gated on `isStable` / `isWarmedUp`, or anywhere a missing result indicates a programmer error rather than an expected state. `getResultOrThrow()` is the canonical accessor on every `IndicatorSeries` / `TechnicalIndicator` subclass and throws a meaningful error.

What you should never do: write `getResult()!`. The `!` is the antipattern; either branch on `undefined` or throw.
