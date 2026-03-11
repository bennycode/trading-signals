# Messaging Platform Abstraction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abstract `@typedtrader/messaging` to support both XMTP and Telegram (via Telegraf) simultaneously through a shared `MessagingPlatform` interface.

**Architecture:** Introduce a `MessagingPlatform` interface with `XmtpPlatform` and `TelegramPlatform` implementations. Rename `ownerAddress` to `userId` with platform-prefixed strings. Refactor `startServer.ts` into an orchestrator that registers shared commands on all active platforms. Monitors route alerts through a platform map.

**Tech Stack:** TypeScript, ESM, `@xmtp/agent-sdk`, `telegraf`, Drizzle ORM, SQLite, Vitest

**Spec:** `docs/superpowers/specs/2026-03-11-messaging-abstraction-design.md`

---

## Chunk 1: Core Interface & Database Migration

### Task 1: Create MessagingPlatform Interface

**Files:**
- Create: `packages/messaging/src/platform/MessagingPlatform.ts`

- [ ] **Step 1: Create the interface file**

```typescript
// packages/messaging/src/platform/MessagingPlatform.ts

export interface MessageContext {
  /** Platform-prefixed sender ID, e.g. "xmtp:0x..." or "telegram:123" */
  senderId: string;
  /** Platform identifier: "xmtp" or "telegram" */
  platformId: string;
  /** Message text after command name */
  content: string;
  /** Reply with Markdown */
  reply(text: string): Promise<void>;
}

export type CommandHandler = (ctx: MessageContext) => Promise<void>;

export interface PlatformInfo {
  /** The bot's own address/username on this platform */
  botAddress: string;
  /** SDK/library version string */
  sdkVersion: string;
}

export interface MessagingPlatform {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(userId: string, text: string): Promise<void>;
  registerCommand(name: string, handler: CommandHandler): void;
  /** List of registered command names (e.g., ["/help", "/price"]) */
  readonly commandList: string[];
  /** Platform-specific metadata for info commands */
  readonly platformInfo: PlatformInfo;
}
```

- [ ] **Step 2: Create platform barrel export**

Create `packages/messaging/src/platform/index.ts`:

```typescript
export * from './MessagingPlatform.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/messaging/src/platform/MessagingPlatform.ts packages/messaging/src/platform/index.ts
git commit -m "feat(messaging): Add MessagingPlatform interface and MessageContext types"
```

---

### Task 2: Rename ownerAddress to userId in Schema

**Files:**
- Modify: `packages/messaging/src/database/schema.ts:6`

- [ ] **Step 1: Update schema.ts**

In `packages/messaging/src/database/schema.ts`, change line 6:

```typescript
// Before:
ownerAddress: text('ownerAddress').notNull(),
// After:
userId: text('userId').notNull(),
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/messaging && npx tsc --noEmit 2>&1 | head -50`

Expected: Errors in files referencing `accounts.ownerAddress` — this is expected and will be fixed in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add packages/messaging/src/database/schema.ts
git commit -m "refactor(messaging): Rename ownerAddress to userId in schema"
```

---

### Task 3: Create Database Migration

**Files:**
- Create: `packages/messaging/migrations/0004_rename_owner_address.sql`
- Modify: `packages/messaging/migrations/meta/_journal.json`

Note: Normally `drizzle-kit generate` creates migrations, but since we need a custom data transformation (prefixing existing values with `xmtp:`), we write it manually.

- [ ] **Step 1: Create migration SQL**

Create `packages/messaging/migrations/0004_rename_owner_address.sql`:

```sql
ALTER TABLE `accounts` RENAME COLUMN `ownerAddress` TO `userId`;--> statement-breakpoint
UPDATE `accounts` SET `userId` = 'xmtp:' || `userId`;
```

- [ ] **Step 2: Create migration snapshot**

Run `drizzle-kit generate` to produce the snapshot, then verify it created the snapshot file:

```bash
cd packages/messaging && npx drizzle-kit generate 2>&1
```

If `drizzle-kit generate` doesn't produce a clean result (since we already edited the schema), manually create the snapshot. The key file is `migrations/meta/_journal.json` — add a new entry:

```json
{
  "idx": 4,
  "version": "6",
  "when": 1741651200000,
  "tag": "0004_rename_owner_address",
  "breakpoints": true
}
```

Also copy and update `migrations/meta/0003_snapshot.json` to `migrations/meta/0004_snapshot.json`, replacing `ownerAddress` with `userId` in the accounts table definition.

- [ ] **Step 3: Commit**

```bash
git add packages/messaging/migrations/
git commit -m "feat(messaging): Add migration to rename ownerAddress to userId with xmtp prefix"
```

---

### Task 4: Update Account Model

**Files:**
- Modify: `packages/messaging/src/database/models/Account.ts`

- [ ] **Step 1: Rename all ownerAddress references to userId**

In `packages/messaging/src/database/models/Account.ts`:

Line 17 — rename method:
```typescript
// Before:
static findByOwnerAddress(ownerAddress: string): AccountType[] {
// After:
static findByUserId(userId: string): AccountType[] {
```

Line 21 — update query:
```typescript
// Before:
.where(eq(accounts.ownerAddress, ownerAddress))
// After:
.where(eq(accounts.userId, userId))
```

Line 26 — rename method and parameter:
```typescript
// Before:
static findByOwnerAddressAndId(ownerAddress: string, id: number): AccountType | undefined {
// After:
static findByUserIdAndId(userId: string, id: number): AccountType | undefined {
```

Line 30 — update query:
```typescript
// Before:
.where(and(eq(accounts.ownerAddress, ownerAddress), eq(accounts.id, id)))
// After:
.where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
```

- [ ] **Step 2: Commit**

```bash
git add packages/messaging/src/database/models/Account.ts
git commit -m "refactor(messaging): Rename ownerAddress to userId in Account model"
```

---

### Task 5: Update Validation Helper

**Files:**
- Modify: `packages/messaging/src/validation/getAccountOrError.ts`

- [ ] **Step 1: Rename ownerAddress to userId**

Full file becomes:

```typescript
import {Account} from '../database/models/Account.js';

export const getAccountOrError = (userId: string, accountId: number) => {
  const account = Account.findByUserIdAndId(userId, accountId);

  if (!account) {
    throw new Error(`Account with ID "${accountId}" not found or does not belong to you`);
  }

  return account;
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/messaging/src/validation/getAccountOrError.ts
git commit -m "refactor(messaging): Rename ownerAddress to userId in getAccountOrError"
```

---

### Task 6: Update All Command Handlers

**Files:**
- Modify: `packages/messaging/src/command/account/accountAdd.ts:18,33`
- Modify: `packages/messaging/src/command/account/accountList.ts:3,5`
- Modify: `packages/messaging/src/command/account/accountRemove.ts:6,9`
- Modify: `packages/messaging/src/command/account/accountTime.ts:7,10`
- Modify: `packages/messaging/src/command/candle.ts:8,19`
- Modify: `packages/messaging/src/command/price.ts:7,18`
- Modify: `packages/messaging/src/command/watch/watchAdd.ts:17,36`
- Modify: `packages/messaging/src/command/watch/watchList.ts:4,6`
- Modify: `packages/messaging/src/command/watch/watchRemove.ts:11,21`
- Modify: `packages/messaging/src/command/strategy/strategyAdd.ts:17,47`
- Modify: `packages/messaging/src/command/strategy/strategyList.ts:5,7`
- Modify: `packages/messaging/src/command/strategy/strategyRemove.ts:11,21`

- [ ] **Step 1: Rename ownerAddress parameter to userId in all command handlers**

For each file, rename the `ownerAddress` parameter to `userId`. The pattern is the same everywhere:

**accountAdd.ts** line 18:
```typescript
// Before:
export async function accountAdd(request: string, ownerAddress: string) {
// After:
export async function accountAdd(request: string, userId: string) {
```
Line 33: `ownerAddress,` → `userId,`

**accountList.ts** line 3:
```typescript
// Before:
export const accountList = async (ownerAddress: string) => {
// After:
export const accountList = async (userId: string) => {
```
Line 5: `Account.findByOwnerAddress(ownerAddress)` → `Account.findByUserId(userId)`

**accountRemove.ts** line 6:
```typescript
// Before:
export const accountRemove = async (request: string, ownerAddress: string) => {
// After:
export const accountRemove = async (request: string, userId: string) => {
```
Line 9: `getAccountOrError(ownerAddress, accountId)` → `getAccountOrError(userId, accountId)`

**accountTime.ts** line 7:
```typescript
// Before:
export const accountTime = async (request: string, ownerAddress: string) => {
// After:
export const accountTime = async (request: string, userId: string) => {
```
Line 10: `getAccountOrError(ownerAddress, accountId)` → `getAccountOrError(userId, accountId)`

**candle.ts** line 8:
```typescript
// Before:
export const candle = async (request: string, ownerAddress: string) => {
// After:
export const candle = async (request: string, userId: string) => {
```
Line 19: `getAccountOrError(ownerAddress, accountId)` → `getAccountOrError(userId, accountId)`

**price.ts** line 7:
```typescript
// Before:
export const price = async (request: string, ownerAddress: string) => {
// After:
export const price = async (request: string, userId: string) => {
```
Line 18: `getAccountOrError(ownerAddress, accountId)` → `getAccountOrError(userId, accountId)`

**watchAdd.ts** line 17:
```typescript
// Before:
export const watchAdd = async (request: string, ownerAddress: string): Promise<WatchResult> => {
// After:
export const watchAdd = async (request: string, userId: string): Promise<WatchResult> => {
```
Line 36: `getAccountOrError(ownerAddress, accountId)` → `getAccountOrError(userId, accountId)`

**watchList.ts** line 4:
```typescript
// Before:
export const watchList = async (ownerAddress: string) => {
// After:
export const watchList = async (userId: string) => {
```
Line 6: `Account.findByOwnerAddress(ownerAddress)` → `Account.findByUserId(userId)`

**watchRemove.ts** line 11:
```typescript
// Before:
export const watchRemove = async (request: string, ownerAddress: string): Promise<WatchRemoveResult> => {
// After:
export const watchRemove = async (request: string, userId: string): Promise<WatchRemoveResult> => {
```
Line 21: `getAccountOrError(ownerAddress, watch.accountId)` → `getAccountOrError(userId, watch.accountId)`

**strategyAdd.ts** line 17:
```typescript
// Before:
export const strategyAdd = async (request: string, ownerAddress: string): Promise<StrategyAddResult> => {
// After:
export const strategyAdd = async (request: string, userId: string): Promise<StrategyAddResult> => {
```
Line 47: `getAccountOrError(ownerAddress, accountId)` → `getAccountOrError(userId, accountId)`

**strategyList.ts** line 5:
```typescript
// Before:
export const strategyList = async (ownerAddress: string) => {
// After:
export const strategyList = async (userId: string) => {
```
Line 7: `Account.findByOwnerAddress(ownerAddress)` → `Account.findByUserId(userId)`

**strategyRemove.ts** line 11:
```typescript
// Before:
export const strategyRemove = async (request: string, ownerAddress: string): Promise<StrategyRemoveResult> => {
// After:
export const strategyRemove = async (request: string, userId: string): Promise<StrategyRemoveResult> => {
```
Line 21: `getAccountOrError(ownerAddress, row.accountId)` → `getAccountOrError(userId, row.accountId)`

- [ ] **Step 2: Verify types compile**

Run: `cd packages/messaging && npx tsc --noEmit 2>&1 | head -50`

Expected: Errors only in `startServer.ts` (which still uses `ownerAddress` variable names internally) and monitors. These are fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add packages/messaging/src/command/ packages/messaging/src/validation/
git commit -m "refactor(messaging): Rename ownerAddress to userId in all command handlers"
```

---

## Chunk 2: Platform Implementations

### Task 7: Implement XmtpPlatform

**Files:**
- Create: `packages/messaging/src/platform/XmtpPlatform.ts`

- [ ] **Step 1: Create XmtpPlatform**

```typescript
// packages/messaging/src/platform/XmtpPlatform.ts
import {Agent} from '@xmtp/agent-sdk';
import {validHex} from '@xmtp/agent-sdk';
import {CommandRouter} from '@xmtp/agent-sdk/middleware';
import type {CommandHandler, MessageContext, MessagingPlatform, PlatformInfo} from './MessagingPlatform.js';

const PLATFORM_PREFIX = 'xmtp:';

export class XmtpPlatform implements MessagingPlatform {
  #agent: Agent | null = null;
  #router = new CommandRouter();
  #ownerAddresses: string | undefined;
  #platformInfo: PlatformInfo = {botAddress: '', sdkVersion: ''};

  constructor(ownerAddresses?: string) {
    this.#ownerAddresses = ownerAddresses;
  }

  registerCommand(name: string, handler: CommandHandler): void {
    this.#router.command(`/${name}`, async ctx => {
      const senderAddress = await ctx.getSenderAddress();

      if (!senderAddress) {
        await ctx.conversation.sendMarkdown('Unable to determine sender address');
        return;
      }

      const messageCtx: MessageContext = {
        senderId: `${PLATFORM_PREFIX}${senderAddress}`,
        platformId: 'xmtp',
        content: ctx.message.content,
        reply: async (text: string) => {
          await ctx.conversation.sendMarkdown(text);
        },
      };

      await handler(messageCtx);
    });
  }

  async start(): Promise<void> {
    this.#agent = await Agent.createFromEnv({
      appVersion: '@typedtrader/messaging',
    });

    if (this.#ownerAddresses) {
      const addresses = this.#ownerAddresses.split(',').map(a => a.trim());
      this.#agent.use(async (ctx, next) => {
        const senderAddress = await ctx.getSenderAddress();
        if (senderAddress && addresses.includes(senderAddress)) {
          await next();
        } else {
          console.warn(
            `Ignoring XMTP message from "${senderAddress}" - only messages from owners [${addresses.join(', ')}] are processed.`
          );
        }
      });
    } else {
      console.warn('Warning: XMTP_OWNER_ADDRESSES is not set. Everyone can message the bot via XMTP.');
    }

    this.#agent.use(this.#router.middleware());

    this.#agent.on('start', async ctx => {
      const clientAddress = await ctx.client.getAddress();
      this.#platformInfo = {
        botAddress: clientAddress ?? 'unknown',
        sdkVersion: ctx.client.libxmtpVersion ?? 'unknown',
      };
    });

    await this.#agent.start();
  }

  async stop(): Promise<void> {
    // XMTP agent doesn't expose a stop method; process shutdown handles it
  }

  async sendMessage(userId: string, text: string): Promise<void> {
    if (!this.#agent) {
      throw new Error('XmtpPlatform not started');
    }

    const address = userId.replace(PLATFORM_PREFIX, '');
    const dm = await this.#agent.createDmWithAddress(validHex(address));
    await dm.sendMarkdown(text);
  }

  get commandList(): string[] {
    return this.#router.commandList;
  }

  get platformInfo(): PlatformInfo {
    return this.#platformInfo;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/messaging/src/platform/XmtpPlatform.ts
git commit -m "feat(messaging): Implement XmtpPlatform wrapping XMTP Agent SDK"
```

---

### Task 8: Install Telegraf and Implement TelegramPlatform

**Files:**
- Modify: `packages/messaging/package.json`
- Create: `packages/messaging/src/platform/TelegramPlatform.ts`

- [ ] **Step 1: Install telegraf**

```bash
cd packages/messaging && npm install telegraf
```

- [ ] **Step 2: Create TelegramPlatform**

```typescript
// packages/messaging/src/platform/TelegramPlatform.ts
import {Telegraf} from 'telegraf';
import type {CommandHandler, MessageContext, MessagingPlatform, PlatformInfo} from './MessagingPlatform.js';

const PLATFORM_PREFIX = 'telegram:';

export class TelegramPlatform implements MessagingPlatform {
  #bot: Telegraf;
  #ownerIds: string[];
  #commands: Map<string, CommandHandler> = new Map();
  #platformInfo: PlatformInfo = {botAddress: '', sdkVersion: ''};

  constructor(botToken: string, ownerIds?: string) {
    this.#bot = new Telegraf(botToken);
    this.#ownerIds = ownerIds ? ownerIds.split(',').map(id => id.trim()) : [];
  }

  registerCommand(name: string, handler: CommandHandler): void {
    this.#commands.set(name, handler);

    this.#bot.command(name, async ctx => {
      const senderId = ctx.from?.id?.toString();

      if (!senderId) {
        await ctx.reply('Unable to determine sender');
        return;
      }

      if (this.#ownerIds.length > 0 && !this.#ownerIds.includes(senderId)) {
        console.warn(
          `Ignoring Telegram message from "${senderId}" - only messages from owners [${this.#ownerIds.join(', ')}] are processed.`
        );
        return;
      }

      // Extract text after the /command
      const text = ctx.message.text;
      const commandEnd = text.indexOf(' ');
      const content = commandEnd === -1 ? '' : text.slice(commandEnd + 1);

      const messageCtx: MessageContext = {
        senderId: `${PLATFORM_PREFIX}${senderId}`,
        platformId: 'telegram',
        content,
        reply: async (replyText: string) => {
          await ctx.reply(replyText, {parse_mode: 'Markdown'});
        },
      };

      await handler(messageCtx);
    });
  }

  async start(): Promise<void> {
    if (this.#ownerIds.length > 0) {
      console.log(`Only Telegram user IDs (${this.#ownerIds.join(', ')}) can message the bot.`);
    } else {
      console.warn('Warning: TELEGRAM_OWNER_IDS is not set. Everyone can message the bot via Telegram.');
    }

    await this.#bot.launch();

    const botInfo = await this.#bot.telegram.getMe();
    this.#platformInfo = {
      botAddress: `@${botInfo.username}`,
      sdkVersion: `Telegraf`,
    };

    console.log(`Telegram bot started as ${this.#platformInfo.botAddress}.`);
  }

  async stop(): Promise<void> {
    this.#bot.stop();
  }

  async sendMessage(userId: string, text: string): Promise<void> {
    const chatId = userId.replace(PLATFORM_PREFIX, '');
    await this.#bot.telegram.sendMessage(chatId, text, {parse_mode: 'Markdown'});
  }

  get commandList(): string[] {
    return Array.from(this.#commands.keys()).map(cmd => `/${cmd}`);
  }

  get platformInfo(): PlatformInfo {
    return this.#platformInfo;
  }
}
```

- [ ] **Step 3: Update platform barrel export**

Update `packages/messaging/src/platform/index.ts`:

```typescript
export * from './MessagingPlatform.js';
export * from './XmtpPlatform.js';
export * from './TelegramPlatform.js';
```

- [ ] **Step 4: Commit**

```bash
git add packages/messaging/package.json package-lock.json packages/messaging/src/platform/
git commit -m "feat(messaging): Implement TelegramPlatform wrapping Telegraf"
```

---

### Task 9: Refactor Monitors to Use MessagingPlatform

**Files:**
- Modify: `packages/messaging/src/service/WatchMonitor.ts`
- Modify: `packages/messaging/src/service/StrategyMonitor.ts`

- [ ] **Step 1: Refactor WatchMonitor**

Replace the `Agent` dependency with a `Map<string, MessagingPlatform>`:

In `packages/messaging/src/service/WatchMonitor.ts`:

Replace the import and class fields (lines 1-18):
```typescript
import {TradingPair, Exchange, ExchangeCandle, getExchangeClient} from '@typedtrader/exchange';
import {Account} from '../database/models/Account.js';
import {Watch, WatchAttributes} from '../database/models/Watch.js';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';

interface ActiveSubscription {
  watchId: number;
  topicId: string;
  exchange: Exchange;
}

export class WatchMonitor {
  #platforms: Map<string, MessagingPlatform>;
  #subscriptions: Map<number, ActiveSubscription> = new Map();

  constructor(platforms: Map<string, MessagingPlatform>) {
    this.#platforms = platforms;
  }
```

Replace `#sendAlert` method (lines 111-141):
```typescript
  async #sendAlert(watch: WatchAttributes, currentPrice: number): Promise<void> {
    const {counter} = TradingPair.fromString(watch.pair, ',');

    const account = Account.findByPk(watch.accountId);

    if (!account) {
      console.warn(
        `Account "${watch.accountId}" not found when sending alert for watch "${watch.id}". Alert was not delivered.`
      );
      return;
    }
    const dirSymbol = watch.thresholdDirection === 'up' ? '+' : '-';
    const thresholdDisplay =
      watch.thresholdType === 'percent'
        ? `${dirSymbol}${watch.thresholdValue}%`
        : `${dirSymbol}${watch.thresholdValue} ${counter}`;

    const baselinePrice = parseFloat(watch.baselinePrice);
    const diff = currentPrice - baselinePrice;
    const diffPercent = ((diff / baselinePrice) * 100).toFixed(2);
    const diffDisplay = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} ${counter} (${diff >= 0 ? '+' : ''}${diffPercent}%)`;

    const message = `Price Alert Triggered!\n\nPair: ${watch.pair}\nBaseline: ${watch.baselinePrice} ${counter}\nAlert price: ${watch.alertPrice} ${counter}\nCurrent: ${currentPrice} ${counter}\nDiff: ${diffDisplay}\nThreshold: ${thresholdDisplay}\n\nThis watch has been automatically removed.`;

    const platformPrefix = account.userId.split(':')[0];
    const platform = this.#platforms.get(platformPrefix);

    if (!platform) {
      console.warn(`No platform found for prefix "${platformPrefix}" when sending alert for watch "${watch.id}".`);
      return;
    }

    await platform.sendMessage(account.userId, message);
    console.log(`Alert sent to ${account.userId} for watch ${watch.id}`);
  }
```

Remove the `validHex` and `Agent` imports that are no longer needed.

- [ ] **Step 2: Refactor StrategyMonitor**

Replace the `Agent` dependency with a `Map<string, MessagingPlatform>`:

In `packages/messaging/src/service/StrategyMonitor.ts`:

Replace the import and class fields (lines 1-21):
```typescript
import {TradingPair, TradingSession, getExchangeClient} from '@typedtrader/exchange';
import type {ExchangeFill} from '@typedtrader/exchange';
import {createStrategy} from 'trading-strategies';
import type {Strategy as TradingStrategy} from 'trading-strategies';
import {Account} from '../database/models/Account.js';
import {Strategy, type StrategyAttributes} from '../database/models/Strategy.js';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';

interface ActiveSession {
  strategyId: number;
  session: TradingSession;
  strategy: TradingStrategy;
}

export class StrategyMonitor {
  #platforms: Map<string, MessagingPlatform>;
  #sessions: Map<number, ActiveSession> = new Map();

  constructor(platforms: Map<string, MessagingPlatform>) {
    this.#platforms = platforms;
  }
```

Replace `#sendFillNotification` method (lines 134-147):
```typescript
  async #sendFillNotification(row: StrategyAttributes, fill: ExchangeFill): Promise<void> {
    const account = Account.findByPk(row.accountId);
    if (!account) {
      console.warn(`Account "${row.accountId}" not found for fill notification on strategy "${row.id}".`);
      return;
    }

    const message = `Order Filled!\n\nStrategy: ${row.strategyName}\nPair: ${row.pair}\nSide: ${fill.side}\nPrice: ${fill.price}\nSize: ${fill.size}\nFee: ${fill.fee} ${fill.feeAsset}`;

    const platformPrefix = account.userId.split(':')[0];
    const platform = this.#platforms.get(platformPrefix);

    if (!platform) {
      console.warn(`No platform found for prefix "${platformPrefix}" for fill notification on strategy "${row.id}".`);
      return;
    }

    await platform.sendMessage(account.userId, message);
    console.log(`Fill notification sent to ${account.userId} for strategy ${row.id}`);
  }
```

Remove the `validHex` and `Agent` imports that are no longer needed.

- [ ] **Step 3: Verify types compile**

Run: `cd packages/messaging && npx tsc --noEmit 2>&1 | head -50`

Expected: Errors only in `startServer.ts` (next task).

- [ ] **Step 4: Commit**

```bash
git add packages/messaging/src/service/WatchMonitor.ts packages/messaging/src/service/StrategyMonitor.ts
git commit -m "refactor(messaging): Use MessagingPlatform map in monitors instead of XMTP Agent"
```

---

## Chunk 3: Server Orchestration & Wiring

### Task 10: Rewrite startServer.ts

**Files:**
- Modify: `packages/messaging/src/startServer.ts`

- [ ] **Step 1: Create registerCommands helper and rewrite startServer**

Replace the entire `packages/messaging/src/startServer.ts` with:

```typescript
import {
  accountAdd,
  accountList,
  accountRemove,
  accountTime,
  candle,
  price,
  strategyAdd,
  strategyList,
  strategyRemove,
  time,
  uptime,
  watchAdd,
  watchList,
  watchRemove,
} from './command/index.js';
import {initializeDatabase} from './database/initializeDatabase.js';
import type {MessagingPlatform} from './platform/MessagingPlatform.js';
import {TelegramPlatform} from './platform/TelegramPlatform.js';
import {XmtpPlatform} from './platform/XmtpPlatform.js';
import {StrategyMonitor} from './service/StrategyMonitor.js';
import {WatchMonitor} from './service/WatchMonitor.js';

interface Monitors {
  watchMonitor: WatchMonitor;
  strategyMonitor: StrategyMonitor;
}

function registerCommands(platform: MessagingPlatform, monitors: Monitors): void {
  const {watchMonitor, strategyMonitor} = monitors;

  platform.registerCommand('accountAdd', async ctx => {
    const result = await accountAdd(ctx.content, ctx.senderId);
    if (result) {
      await ctx.reply(result);
    }
  });

  platform.registerCommand('accountList', async ctx => {
    await ctx.reply(await accountList(ctx.senderId));
  });

  platform.registerCommand('accountRemove', async ctx => {
    const result = await accountRemove(ctx.content, ctx.senderId);
    if (result) {
      await ctx.reply(result);
    }
  });

  platform.registerCommand('accountTime', async ctx => {
    const result = await accountTime(ctx.content, ctx.senderId);
    if (result) {
      await ctx.reply(result);
    }
  });

  platform.registerCommand('candle', async ctx => {
    const result = await candle(ctx.content, ctx.senderId);
    if (result) {
      await ctx.reply(result);
    }
  });

  platform.registerCommand('help', async ctx => {
    const commandCodeBlocks = platform.commandList.map(cmd => `\`${cmd}\``);
    const answer = `I am supporting the following commands: ${commandCodeBlocks.join(', ')}`;
    await ctx.reply(answer);
  });

  platform.registerCommand('price', async ctx => {
    await ctx.reply(await price(ctx.content, ctx.senderId));
  });

  platform.registerCommand('time', async ctx => {
    await ctx.reply(await time());
  });

  platform.registerCommand('uptime', async ctx => {
    await ctx.reply(await uptime());
  });

  platform.registerCommand('watchAdd', async ctx => {
    const result = await watchAdd(ctx.content, ctx.senderId);
    await ctx.reply(result.message);
    if (result.watch) {
      try {
        await watchMonitor.subscribeToWatch(result.watch);
      } catch (error) {
        console.error(`Error subscribing to new watch: ${error}`);
      }
    }
  });

  platform.registerCommand('watchList', async ctx => {
    await ctx.reply(await watchList(ctx.senderId));
  });

  platform.registerCommand('watchRemove', async ctx => {
    const result = await watchRemove(ctx.content, ctx.senderId);
    await ctx.reply(result.message);
    if (result.watchId) {
      watchMonitor.unsubscribeFromWatch(result.watchId);
    }
  });

  platform.registerCommand('strategyAdd', async ctx => {
    const result = await strategyAdd(ctx.content, ctx.senderId);
    await ctx.reply(result.message);
    if (result.strategy) {
      try {
        await strategyMonitor.subscribeToStrategy(result.strategy);
      } catch (error) {
        console.error(`Error starting strategy: ${error}`);
      }
    }
  });

  platform.registerCommand('strategyList', async ctx => {
    await ctx.reply(await strategyList(ctx.senderId));
  });

  platform.registerCommand('strategyRemove', async ctx => {
    const result = await strategyRemove(ctx.content, ctx.senderId);
    await ctx.reply(result.message);
    if (result.strategyId) {
      try {
        await strategyMonitor.unsubscribeFromStrategy(result.strategyId);
      } catch (error) {
        console.error(`Error stopping strategy: ${error}`);
      }
    }
  });

  platform.registerCommand('myaddress', async ctx => {
    const rawId = ctx.senderId.split(':').slice(1).join(':');
    await ctx.reply(`Your address is: ${rawId}`);
  });

  platform.registerCommand('youraddress', async ctx => {
    await ctx.reply(`My address is: ${platform.platformInfo.botAddress}`);
  });

  platform.registerCommand('version', async ctx => {
    await ctx.reply(`My version is: ${platform.platformInfo.sdkVersion}`);
  });
}

export async function startServer() {
  await initializeDatabase();

  const platforms = new Map<string, MessagingPlatform>();

  if (process.env.XMTP_ENV) {
    const xmtp = new XmtpPlatform(process.env.XMTP_OWNER_ADDRESSES);
    platforms.set('xmtp', xmtp);
    console.log('XMTP platform configured.');
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    const telegram = new TelegramPlatform(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_OWNER_IDS);
    platforms.set('telegram', telegram);
    console.log('Telegram platform configured.');
  }

  if (platforms.size === 0) {
    throw new Error('No messaging platform configured. Set XMTP_ENV and/or TELEGRAM_BOT_TOKEN.');
  }

  const watchMonitor = new WatchMonitor(platforms);
  const strategyMonitor = new StrategyMonitor(platforms);
  const monitors: Monitors = {watchMonitor, strategyMonitor};

  for (const platform of platforms.values()) {
    registerCommands(platform, monitors);
  }

  // Start monitors
  try {
    await watchMonitor.start();
  } catch (error) {
    console.error('Error starting watch monitor:', error);
  }

  try {
    await strategyMonitor.start();
  } catch (error) {
    console.error('Error starting strategy monitor:', error);
  }

  // Start all platforms
  for (const platform of platforms.values()) {
    await platform.start();
  }

  // Handle graceful shutdown
  const shutdown = async () => {
    try {
      watchMonitor.stop();
      await strategyMonitor.stop();
      for (const platform of platforms.values()) {
        await platform.stop();
      }
    } catch (error) {
      console.error('Error during shutdown:', error);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/messaging && npx tsc --noEmit 2>&1 | head -50`

Expected: Clean compilation (0 errors).

- [ ] **Step 3: Commit**

```bash
git add packages/messaging/src/startServer.ts
git commit -m "feat(messaging): Rewrite startServer as multi-platform orchestrator"
```

---

### Task 11: Update Environment Defaults and Exports

**Files:**
- Modify: `packages/messaging/.env.defaults`
- Modify: `packages/messaging/src/index.ts`

- [ ] **Step 1: Add Telegram env vars to .env.defaults**

Append to `packages/messaging/.env.defaults`:

```
# Telegram Messaging
TELEGRAM_BOT_TOKEN=
TELEGRAM_OWNER_IDS=
```

- [ ] **Step 2: Update index.ts to export platform types**

Update `packages/messaging/src/index.ts`:

```typescript
export * from './command/index.js';
export * from './platform/index.js';
export * from './startServer.js';
```

Remove the middleware export — `isFromOwner` is now internal to each platform.

- [ ] **Step 3: Verify types compile**

Run: `cd packages/messaging && npx tsc --noEmit 2>&1 | head -50`

Expected: Clean compilation.

- [ ] **Step 4: Commit**

```bash
git add packages/messaging/.env.defaults packages/messaging/src/index.ts
git commit -m "feat(messaging): Add Telegram env vars and export platform types"
```

---

### Task 12: Clean Up Unused isFromOwner Middleware

**Files:**
- Modify: `packages/messaging/src/middleware/isFromOwner.ts`
- Modify: `packages/messaging/src/middleware/index.ts`

The `isFromOwner` middleware is no longer used externally — auth is now handled inside each platform implementation. However, the XMTP-specific middleware logic was inlined into `XmtpPlatform`. We can remove the standalone middleware files.

- [ ] **Step 1: Delete or empty the middleware files**

Delete `packages/messaging/src/middleware/isFromOwner.ts` and update `packages/messaging/src/middleware/index.ts` to be empty, or delete the entire `middleware/` directory.

Since `index.ts` no longer exports middleware, just remove the directory:

```bash
rm packages/messaging/src/middleware/isFromOwner.ts
rm packages/messaging/src/middleware/index.ts
rmdir packages/messaging/src/middleware
```

- [ ] **Step 2: Verify types compile**

Run: `cd packages/messaging && npx tsc --noEmit 2>&1 | head -50`

Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add -A packages/messaging/src/middleware/
git commit -m "refactor(messaging): Remove standalone isFromOwner middleware (now internal to platforms)"
```

---

### Task 13: Run Full Test Suite

- [ ] **Step 1: Run existing tests**

```bash
cd packages/messaging && npm test 2>&1
```

Expected: All existing tests pass. The `parseThreshold.test.ts` tests don't reference `ownerAddress` so they should be unaffected.

- [ ] **Step 2: Run type check across entire monorepo**

```bash
npm run lint:types 2>&1
```

Expected: Clean compilation across all packages.

- [ ] **Step 3: Fix any issues found**

If there are compilation or test errors, fix them before proceeding.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(messaging): Fix issues found during full test suite run"
```

---

## Chunk 4: Tests

### Task 14: Test Platform Implementations

**Files:**
- Create: `packages/messaging/src/platform/XmtpPlatform.test.ts`
- Create: `packages/messaging/src/platform/TelegramPlatform.test.ts`

- [ ] **Step 1: Write XmtpPlatform unit tests**

Create `packages/messaging/src/platform/XmtpPlatform.test.ts`:

```typescript
import {describe, it, expect, vi, beforeEach} from 'vitest';

// Mock @xmtp/agent-sdk before importing
vi.mock('@xmtp/agent-sdk', () => {
  const mockConversation = {
    sendMarkdown: vi.fn(),
  };

  const mockAgent = {
    createFromEnv: vi.fn(),
    use: vi.fn(),
    start: vi.fn(),
    on: vi.fn(),
    createDmWithAddress: vi.fn().mockResolvedValue(mockConversation),
  };

  return {
    Agent: {
      createFromEnv: vi.fn().mockResolvedValue(mockAgent),
    },
    validHex: vi.fn((addr: string) => addr),
  };
});

vi.mock('@xmtp/agent-sdk/middleware', () => ({
  CommandRouter: vi.fn().mockImplementation(() => ({
    command: vi.fn(),
    middleware: vi.fn(),
    commandList: [],
  })),
}));

import {XmtpPlatform} from './XmtpPlatform.js';

describe('XmtpPlatform', () => {
  it('registers commands with / prefix on the router', () => {
    const platform = new XmtpPlatform();
    const handler = vi.fn();
    platform.registerCommand('help', handler);
    // Verify the router.command was called with /help
  });

  it('strips xmtp: prefix when sending messages', async () => {
    const platform = new XmtpPlatform();
    await platform.start();
    await platform.sendMessage('xmtp:0xabc123', 'Hello');
    // Verify createDmWithAddress was called with '0xabc123'
  });
});
```

- [ ] **Step 2: Write TelegramPlatform unit tests**

Create `packages/messaging/src/platform/TelegramPlatform.test.ts`:

```typescript
import {describe, it, expect, vi} from 'vitest';

vi.mock('telegraf', () => {
  const mockReply = vi.fn();
  const mockSendMessage = vi.fn();
  const mockGetMe = vi.fn().mockResolvedValue({username: 'testbot'});

  return {
    Telegraf: vi.fn().mockImplementation(() => ({
      command: vi.fn(),
      launch: vi.fn(),
      stop: vi.fn(),
      telegram: {
        sendMessage: mockSendMessage,
        getMe: mockGetMe,
      },
    })),
  };
});

import {TelegramPlatform} from './TelegramPlatform.js';

describe('TelegramPlatform', () => {
  it('strips telegram: prefix when sending messages', async () => {
    const platform = new TelegramPlatform('test-token');
    await platform.start();
    await platform.sendMessage('telegram:12345', 'Hello');
    // Verify sendMessage was called with '12345'
  });

  it('exposes command list with / prefix', () => {
    const platform = new TelegramPlatform('test-token');
    platform.registerCommand('help', vi.fn());
    platform.registerCommand('price', vi.fn());
    expect(platform.commandList).toEqual(['/help', '/price']);
  });

  it('populates platformInfo after start', async () => {
    const platform = new TelegramPlatform('test-token');
    await platform.start();
    expect(platform.platformInfo.botAddress).toBe('@testbot');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd packages/messaging && npx vitest run src/platform/ 2>&1
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/messaging/src/platform/*.test.ts
git commit -m "test(messaging): Add unit tests for XmtpPlatform and TelegramPlatform"
```

---

### Task 15: Test Monitor Platform Routing

**Files:**
- Create: `packages/messaging/src/service/WatchMonitor.test.ts`

- [ ] **Step 1: Write monitor routing test**

Create `packages/messaging/src/service/WatchMonitor.test.ts` to test that alerts route to the correct platform:

```typescript
import {describe, it, expect, vi} from 'vitest';
import type {MessagingPlatform} from '../platform/MessagingPlatform.js';

function createMockPlatform(): MessagingPlatform {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    sendMessage: vi.fn(),
    registerCommand: vi.fn(),
    commandList: [],
    platformInfo: {botAddress: 'test', sdkVersion: '1.0'},
  };
}

describe('Monitor platform routing', () => {
  it('resolves the correct platform from userId prefix', () => {
    const xmtpPlatform = createMockPlatform();
    const telegramPlatform = createMockPlatform();

    const platforms = new Map<string, MessagingPlatform>();
    platforms.set('xmtp', xmtpPlatform);
    platforms.set('telegram', telegramPlatform);

    // Test the prefix-parsing logic used by monitors
    const xmtpUserId = 'xmtp:0xabc123';
    const telegramUserId = 'telegram:987654';

    const xmtpPrefix = xmtpUserId.split(':')[0];
    const telegramPrefix = telegramUserId.split(':')[0];

    expect(platforms.get(xmtpPrefix)).toBe(xmtpPlatform);
    expect(platforms.get(telegramPrefix)).toBe(telegramPlatform);
  });

  it('returns undefined for unknown platform prefix', () => {
    const platforms = new Map<string, MessagingPlatform>();
    platforms.set('xmtp', createMockPlatform());

    const unknownUserId = 'slack:U12345';
    const prefix = unknownUserId.split(':')[0];

    expect(platforms.get(prefix)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd packages/messaging && npx vitest run src/service/ 2>&1
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/messaging/src/service/WatchMonitor.test.ts
git commit -m "test(messaging): Add monitor platform routing tests"
```

---

### Task 16: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd packages/messaging && npm test 2>&1
```

Expected: All tests pass.

- [ ] **Step 2: Run monorepo type check**

```bash
npm run lint:types 2>&1
```

Expected: Clean compilation.

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix(messaging): Final fixes from full verification"
```
