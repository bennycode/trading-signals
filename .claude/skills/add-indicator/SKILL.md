---
name: add-indicator
description: Orchestrate adding technical indicators to the trading-signals package with parallel subagents, reference-data verification, full quality gates, and the Copilot review loop. Use when asked to add, implement, or source indicators, whether a single one or in bulk from another library's feature list.
---

# Add Indicator Pipeline

You are the integrator. Subagents write indicator code; you alone touch git, shared files, and pull requests. The per-indicator recipe and all code/test conventions live in `packages/trading-signals/CLAUDE.md` and are the authority; this skill covers the orchestration around that recipe.

## 1. Scope the work

Compare the requested indicators against the "Supported Technical Indicators" list in `packages/trading-signals/README.md`. Indicators travel under many names (WSMA = SMMA = MEMA), so check codes and aliases before declaring one missing. For bulk sourcing from another library, build the complete work list first and confirm it with the user before spawning agents.

## 2. Branch

Create a feature branch from `origin/main`. Never commit to main, never push to main, and never merge a PR without an explicit request in the user's own words; the open PR is the stopping point.

## 3. Fan out workers

Spawn one background agent per indicator using `agent-prompt-template.md` in this skill directory. Fill in the indicator name, code, category folder, the exact three files to create, and the verification data source. Cap parallelism at 4 to 6 agents. Workers never run git commands and never edit shared files (barrels, README, demo registries). If an agent stalls, resume it with a message instead of respawning; if an agent reports SKIPPED, accept the refusal and surface the reason to the user.

## 4. Verification data hierarchy

Every indicator must reproduce external reference values. Prefer sources in this order:

1. Tulip Indicators `untest.txt` (pin v0.9.1). Match to three decimals, link the exact lines in a test comment, and tag the test with `{tags: ['tulipindicators']}`. Fetch with `curl -s https://raw.githubusercontent.com/TulipCharts/tulipindicators/v0.9.1/tests/untest.txt`.
2. TA-Lib behavior anchors for Ehlers-style indicators (link the `ta_func` C source; match emissions bar-for-bar including lookback).
3. Skender fixtures, but only for pure-window math. SMA-seeded EMA recursions do not transfer because this repo seeds from the first input.
4. Hand-derived exact-fraction worksheets plus property tests, documented in the test file.

Rounding ties: reference values printed by C can differ from JavaScript `toFixed` in the last digit when the true value sits exactly half-way (for example 84.4575). Keep the value this library computes and document the tie in the fixture comment; never loosen the assertion precision to hide it.

Deviations from a reference (NaN policies, dead-market behavior) follow the dead-market rule in CLAUDE.md and must be documented in a comment where they occur.

## 5. Integrate (orchestrator only)

After each worker finishes, wire the shared files yourself: the category barrel `src/<category>/index.ts` (alphabetical), the README indicator list (alphabetical), and the docs demo registration in `packages/trading-signals-docs/indicator-demos/<category>/index.tsx`. The demo import name must match the demo file's actual export. Commit one indicator per commit as `feat(trading-signals): add <Name> (<CODE>)`.

## 6. Gates, in cost order

1. Scoped tests from `packages/trading-signals/`: `npx vitest run --dir src/<category>/<CODE>`. Use exactly one `--dir` per invocation; bare path filters also match stale copies under `.claude/worktrees/`.
2. `npx tsc --noEmit` from `packages/trading-signals/`.
3. Root `npm test` (knip plus all package suites; coverage thresholds are 100% across all metrics and fail the build).
4. Root `npm run lint` (oxlint plus oxfmt; oxfmt must run from the repo root).

Shell discipline: the working directory persists between commands, so prefer `git -C <repo-root>` and absolute paths, and never read a pipe's exit code as the command's.

## 7. PR and the Copilot loop

Push the branch and open a PR describing what was added, which references verified it, and which gates ran. Then request a Copilot review:

```bash
gh api -X POST repos/<owner>/<repo>/pulls/<N>/requested_reviewers \
  -f 'reviewers[]=copilot-pull-request-reviewer[bot]'
```

`gh pr edit --add-reviewer Copilot` silently fails; use the REST call above. Poll the reviews until one arrives, then read its verdict from the "generated N comments" line in the review body.

For every finding, fix the code, run the gates, push, and re-request review. Repeat until the latest review says "no new comments", then resolve the addressed threads via the GraphQL `resolveReviewThread` mutation. For a false positive, verify with arithmetic or a test, keep the code, add an explanatory comment at the disputed location, and tell the user. Never post PR comments, review replies, or thread messages: code gets pushed, words get drafted for the user to approve.

## 8. Stacking and merging (only on explicit request)

For multi-PR campaigns, base each PR on the previous branch so slices stay reviewable. When the user asks to merge the stack, run the train one PR at a time:

1. Retarget the child PR to main before merging its parent, otherwise GitHub auto-closes the child when the parent branch is deleted.
2. Squash-merge the parent with `--delete-branch`, then fast-forward local main.
3. Rebase the child: `git rebase --onto origin/main <old-parent-tip-sha> <child-branch>` and push with `--force-with-lease`. Record branch tip SHAs before anything gets deleted.
4. Wait for the child's full CI (the test workflows only run against main), then repeat.

Local `package-lock.json` drift blocks rebases; stash it around the train and pop it afterwards.
