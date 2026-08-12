---
name: code-review
description: Repository coding standards for reviewing pull requests. Apply when reviewing TypeScript code.
---

# Code Review Standards

This repository's coding standards live in [`.claude/rules/`](../../../.claude/rules/). Read the rule files relevant to the changed code and enforce them during review.

## Verify test quality with mutation testing

Every changed test must be able to fail. Flag assertions that would still pass if the change under review were reverted, and name the mutation that survives.

When a test's discriminating power is unclear, run Stryker on the file under test instead of guessing (set up in `packages/exchange`):

```sh
cd packages/exchange
npm run test:mutation                                   # full package (~16s)
npx stryker run --mutate src/candle/CandleBatcher.ts    # scoped to the file under review
```

Surviving mutants in the changed code are test gaps — report each one with its file, line, and the mutation that survived.
