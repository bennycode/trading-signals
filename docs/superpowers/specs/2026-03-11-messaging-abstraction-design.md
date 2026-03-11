# Messaging Platform Abstraction Design

## Goal

Abstract the `@typedtrader/messaging` package so it supports both XMTP and Telegram (via Telegraf) simultaneously in a single process, with a shared database and shared command interface.

## Decisions

- **User identity**: Platform-prefixed strings (e.g., `xmtp:0xabc...`, `telegram:123456`). No cross-platform linking.
- **Concurrency**: Both platforms run simultaneously in one process, shared DB and monitors.
- **Command interface**: Identical slash-command syntax on both platforms.
- **Authentication**: Per-platform owner middleware (wallet address whitelist for XMTP, user ID whitelist for Telegram).
- **Dependencies**: Both `@xmtp/agent-sdk` and `telegraf` are required dependencies.

## Architecture

### Core Interface

```typescript
interface MessagingPlatform {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(userId: string, text: string): Promise<void>;
  registerCommand(name: string, handler: CommandHandler): void;
}

interface ReplyOptions {
  markdown?: boolean;
}

interface MessageContext {
  senderId: string; // Platform-prefixed, e.g. "xmtp:0x..." or "telegram:123"
  platformId: string; // "xmtp" or "telegram"
  content: string; // Message text after command name
  reply(text: string, options?: ReplyOptions): Promise<void>;
}

type CommandHandler = (ctx: MessageContext) => Promise<void>;
```

### Platform-Specific Commands

Most commands are shared across platforms. Three commands have platform-specific behavior:

| Command | XMTP | Telegram |
| --- | --- | --- |
| `/myaddress` | Sender's wallet address | Sender's Telegram user ID |
| `/youraddress` | Bot's wallet address | Bot's username |
| `/version` | libXMTP version | Telegraf version |

These commands are registered on all platforms but their handlers receive `ctx.platformId` to return platform-appropriate responses.

### Platform Implementations

#### XmtpPlatform

Wraps `@xmtp/agent-sdk` Agent and CommandRouter.

- `senderId` = `"xmtp:" + ctx.getSenderAddress()`
- `platformId` = `"xmtp"`
- `content` = `ctx.message.content` after command name
- `reply(text)` = `ctx.conversation.sendText(text)`
- `reply(text, {markdown: true})` = `ctx.conversation.sendMarkdown(text)`
- `sendMessage(userId, text)` = strip `"xmtp:"` prefix, call `agent.createDmWithAddress(validHex(address))` then send
- Configured via existing env vars: `XMTP_ENV`, `XMTP_OWNER_ADDRESSES`
- Auth middleware: checks sender wallet against `XMTP_OWNER_ADDRESSES`, applied internally during `start()`

#### TelegramPlatform

Wraps Telegraf `Bot`.

- `senderId` = `"telegram:" + ctx.from.id`
- `platformId` = `"telegram"`
- `content` = message text after command name
- `reply(text)` = `ctx.reply(text)`
- `reply(text, {markdown: true})` = `ctx.reply(text, {parse_mode: 'Markdown'})`
- `sendMessage(userId, text)` = strip `"telegram:"` prefix, call `bot.telegram.sendMessage(numericId, text)`
- Configured via `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_IDS`
- Auth middleware: checks sender user ID against `TELEGRAM_OWNER_IDS`, applied internally during `start()`
- **Constraint**: Telegram bots can only send messages to users who have previously messaged the bot. If `sendMessage` is called for a user who has never interacted with the bot, the Telegram API will reject it.

### sendMessage Contract

- `sendMessage(userId, text)` accepts the full platform-prefixed userId (e.g., `"xmtp:0xabc..."`)
- Each platform implementation strips its own prefix to extract the native address/ID
- Throws on failure (network error, invalid address, Telegram user hasn't started chat). Callers (monitors) catch and handle errors.

### File Structure

```
src/
  platform/
    MessagingPlatform.ts      # Interface + MessageContext + ReplyOptions types
    XmtpPlatform.ts           # XMTP implementation
    TelegramPlatform.ts       # Telegram implementation
    index.ts                  # Exports
```

## Database & Identity Changes

### Schema

Rename `ownerAddress` to `userId` in the accounts table. Store platform-prefixed strings.

Affected files:

- `schema.ts` — rename column
- New Drizzle migration
- `Account.ts`, `Watch.ts`, `Strategy.ts` — rename parameter/query references
- All command handlers — rename `ownerAddress` to `userId`

### Data Migration

The Drizzle migration must both rename the column and transform existing data:

```sql
ALTER TABLE accounts RENAME COLUMN ownerAddress TO userId;
UPDATE accounts SET userId = 'xmtp:' || userId;
```

This is a one-way migration. Existing `ownerAddress` values (raw wallet addresses) are prefixed with `"xmtp:"` since all existing users are XMTP users.

### Monitor Routing

`WatchMonitor` and `StrategyMonitor` change from calling `agent.createDmWithAddress()` directly to:

1. Look up `userId` from the watch/strategy's account
2. Determine platform from prefix
3. Call `sendMessage(userId, alertText)` on the correct `MessagingPlatform`

Monitors receive a `Map<string, MessagingPlatform>` keyed by platform prefix (e.g., `"xmtp"`, `"telegram"`) to resolve the right platform from a userId.

## Server Orchestration

`startServer.ts` becomes the orchestrator:

1. Initialize database
2. Create platform instances based on env vars:
   - `XMTP_ENV` set → `XmtpPlatform`
   - `TELEGRAM_BOT_TOKEN` set → `TelegramPlatform`
   - Both → both start
3. Register all commands on all active platforms via shared helper
4. Pass active platforms map to monitors for alert routing
5. Start all platforms
6. Handle graceful shutdown for all platforms

### Command Registration

```typescript
interface Monitors {
  watchMonitor: WatchMonitor;
  strategyMonitor: StrategyMonitor;
}

function registerCommands(platform: MessagingPlatform, monitors: Monitors) {
  platform.registerCommand('accountAdd', async ctx => {
    const result = await accountAdd(ctx.content, ctx.senderId);
    await ctx.reply(result);
  });

  platform.registerCommand('watchAdd', async ctx => {
    const result = await watchAdd(ctx.content, ctx.senderId);
    await ctx.reply(result.message);
    monitors.watchMonitor.subscribeToWatch(result.watch);
  });

  // ... same pattern for all other commands
}
```

### New Environment Variables

```
TELEGRAM_BOT_TOKEN=...          # Telegraf bot token
TELEGRAM_OWNER_IDS=123,456      # Comma-separated allowed Telegram user IDs
```

## Testing

- **Command handlers**: Existing tests need only `ownerAddress` → `userId` rename. Logic unchanged.
- **Platform implementations**: Test native context → `MessageContext` mapping. Mock SDKs.
- **Middleware**: Test both platforms with allowed/denied IDs.
- **Monitors**: Test alert routing to correct platform based on userId prefix.
- **Integration**: Test `startServer` initializes correct platforms based on env vars.
- **sendMessage failure**: Test that monitors gracefully handle thrown errors from `sendMessage` (e.g., Telegram user hasn't started chat).
