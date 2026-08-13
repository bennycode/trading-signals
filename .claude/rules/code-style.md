---
paths:
  - '**/*.{ts,tsx}'
---

# Code Style

## Comments add intent, not a restatement of the implementation

A comment on a function, type, or member must not re-describe what the code already says — not the formula it computes, not its parameters, not its return value, not a fact the type system already enforces. Those restatements add nothing a reader can't see in the signature, and they rot the moment the code changes.

A comment earns its place only by adding **intent or context that the name doesn't already carry**: why the thing exists, what problem it solves, a non-obvious invariant, a domain term, or a gotcha. If the name already makes the intent clear, the best comment is no comment.

### Don't restate the implementation, the params, or the return

```ts
// ❌ Bad: restates the formula AND the params — all visible in the signature
/** Expresses an ATR reading as a percentage of price: `atr / price * 100`. Feed it `{high, low, close}`. */
function atrToPercent(atr: number, price: number) {
  return (atr / price) * 100;
}
```

```ts
// ✅ Good: explains WHY the function exists (its intent), not HOW it computes
/**
 * Makes volatility comparable across instruments: a raw $52 ATR means nothing without the price,
 * but "7% per bar" compares directly between a $7 and a $700 stock.
 */
function atrToPercent(atr: number, price: number) {
  return (atr / price) * 100;
}
```

```ts
// ❌ Bad: the name and boolean return already say this
/** `true` once the underlying ATR has enough data to produce a stable reading. */
get isReady() {
  return this.#atr.isStable;
}

// ✅ Good: no comment needed
get isReady() {
  return this.#atr.isStable;
}
```

### Prove a claimed intent with a test

When a comment asserts an intent ("makes volatility comparable across instruments"), back it with a test that demonstrates that claim, so the intent is executable and can't silently break.

### Encode invariants in the type system, not in prose

If a comment describes a rule ("must be paired with `atrMultiple`", "at least one is required"), express it with the type system (discriminated unions, branded types) instead of asserting it in a comment the compiler can't enforce.

### Define domain terms once, at the source

Jargon a newcomer can't infer (`risk-on`, `SPY`, `whippy`) should be defined once where it originates — not left bare, and not re-explained at every call site. Use `{@link}` to point back to that definition.

## Avoid `getResult()!` non-null assertion

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

What you should never do: write `getResult()!`. The `!` is the antipattern; either branch on `undefined` or throw.
