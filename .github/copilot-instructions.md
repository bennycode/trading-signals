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
