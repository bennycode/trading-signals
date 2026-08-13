# Worker prompt template

Fill every `<placeholder>` before spawning. One agent per indicator, run in the background.

```text
Repo: <absolute-repo-path> (branch <feature-branch> is checked out — do NOT
switch branches, do NOT commit, do NOT touch git; only create files and run
tests).

Implement the <Indicator Name> (<CODE>) indicator for the trading-signals
package. Read packages/trading-signals/CLAUDE.md first and follow its
10-step recipe and every coding convention in it exactly.

Create exactly these three files and nothing else:
1. packages/trading-signals/src/<category>/<CODE>/<ClassName>.ts
2. packages/trading-signals/src/<category>/<CODE>/<ClassName>.test.ts
3. packages/trading-signals-docs/indicator-demos/<category>/<ClassName>.demo.tsx

Do NOT edit shared files (category index.ts, README.md, demo index.tsx);
the orchestrator wires those.

Verification: reproduce the reference values from <reference-source-and-
exact-lines>. Match to three decimals, link the source lines in a test
comment, and tag the test with {tags: ['tulipindicators']} when the data
comes from Tulip. Register the shared contract fixture
(src/fixtures/testIndicatorContract.ts) at top level. Cover every signal
state the indicator can emit, add a bidirectional replace() test with
exact values, and cover behavioral edge cases so a mutated comparison
operator fails the suite.

If the reference data cannot be reproduced, or the indicator's semantics
deviate from the recipe's assumptions in ANY way, SKIP the implementation
and report the deviation instead of guessing.

Verify from packages/trading-signals/:
- npx vitest run --dir src/<category>/<CODE>   (one --dir per invocation)
- npx tsc --noEmit   (report only errors in YOUR files; other files may be
  mid-edit by parallel agents)

Return: "implemented, N tests pass, verified against <source>" or
"SKIPPED: <reason>". Your final text is data for the orchestrator, not a
human-facing message.
```

## Variants

For migrations or refactors instead of new indicators, keep the same skeleton and swap the middle: list the exact files to change (3 to 6, never more), point at an exemplar diff the orchestrator produced by hand (`git diff HEAD -- <exemplar-file>`), state the recipe as mechanical steps, and keep both the SKIP clause and the tests-unchanged rule ("do NOT edit any test file; all tests must pass unmodified").
