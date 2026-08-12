---
name: code-review
description: Repository coding standards for reviewing pull requests. Apply when reviewing TypeScript code, tests, comments/JSDoc, or Playwright e2e specs in this repository.
---

# Code Review Standards

This repository's coding standards live in `.claude/rules/` (shared with Claude Code). That directory is the single source of truth — do not restate its rules here. Read the rule files relevant to the changed code and enforce them during review.

## Rule index

| Rule file | Applies to |
| --- | --- |
| [`.claude/rules/no-non-null-assertion-on-getResult.md`](../../../.claude/rules/no-non-null-assertion-on-getResult.md) | Any indicator usage: `getResult()!` is never acceptable — require a branch on `undefined` or `getResultOrThrow()`. |
| [`.claude/rules/comments-add-intent-not-implementation.md`](../../../.claude/rules/comments-add-intent-not-implementation.md) | Any changed comments or JSDoc: comments must add intent or context, never restate the implementation, parameters, or types. |
| [`.claude/rules/vitest-mocking.md`](../../../.claude/rules/vitest-mocking.md) | Any `*.test.ts`/`*.test.tsx` changes: typed `vi.fn()` signatures, `vi.mock(import(...))` form, automock vs. factory choice, narrow per-export casts, no manual mock restoration. |
| [`.claude/rules/docs-e2e.md`](../../../.claude/rules/docs-e2e.md) | Changes under `packages/trading-signals-docs/e2e/`: E2E specs only for cross-cutting browser behavior, class-based page objects, ~3-line test bodies. |

If `.claude/rules/` contains files not listed above, apply them too — the table is an index, not a filter.

## Review expectations

- Only flag clear violations of these rules; do not raise stylistic preferences the rules don't cover.
- When flagging a violation, name the rule file so the author can read the full rationale.
