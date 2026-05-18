# Messaging Package

## Account Ownership

Any code path that looks up an `Account` by id on behalf of a user must go through `getAccountOrError(userId, accountId)` (`src/validation/getAccountOrError.ts`). It combines existence and ownership in a single check and throws a user-facing error when the account is missing or belongs to someone else.

```ts
// ✅ Correct — existence + ownership in one call.
const account = getAccountOrError(userId, accountId);

// ❌ Avoid — `findByPk` ignores ownership, and a manual `userId` comparison is easy
//    to forget. Bypassing the helper has already let cross-user mismatches slip
//    through (see ReportScheduler#runAndNotify).
const account = Account.findByPk(accountId);
if (!account) { ... }
if (account.userId !== userId) { ... }
```

Background paths (e.g. `ReportScheduler`, `StrategyMonitor`) catch the thrown error, log a `warn`, and skip the run instead of surfacing it to a user.
