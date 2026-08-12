# Put test expectations in `expect` messages, not comments

When an assertion needs an explanation, pass it as the message argument — `expect(actual, message)` — instead of writing a comment above the line. A comment is invisible at the moment it matters most: when the test fails, the comment stays in the source while the terminal shows only the raw value mismatch. The message prints in the failure output, right where you debug.

```ts
// ❌ Bad: the explanation is lost at failure time
// The zero-volume candle stays in the batch instead of being dropped
expect(batchedCandles.length).toBe(1);

// ✅ Good: the explanation prints when the assertion fails
expect(batchedCandles.length, 'zero-volume candle stays in the batch instead of being dropped').toBe(1);
```

The message states the expectation or invariant being protected — never the mechanics (`'length should be 1'` adds nothing the diff doesn't show). Not every `expect` needs a message: add one exactly where you would otherwise have written a comment.
