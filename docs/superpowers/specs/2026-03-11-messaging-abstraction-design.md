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
  use(middleware: Middleware): void;
}

interface MessageContext {
  senderId: string;   // Platform-prefixed, e.g. "xmtp:0x..." or "telegram:123"
  content: string;    // Message text after command name
  reply(text: string): Promise<void>;
}

type CommandHandler = (ctx: MessageContext) => Promise<void>;
type Middleware = (ctx: MessageContext, next: () => Promise<void>) => Promise<void>;
```

### Platform Implementations

#### XmtpPlatform

Wraps `@xmtp/agent-sdk` Agent and CommandRouter.

- `senderId` = `"xmtp:" + ctx.getSenderAddress()`
- `content` = `ctx.message.content` after command name
- `reply()` = `ctx.conversation.sendText()`
- `sendMessage()` = `agent.createDmWithAddress(validHex(address))` then send
- Configured via existing env vars: `XMTP_ENV`, `XMTP_OWNER_ADDRESSES`

#### TelegramPlatform

Wraps Telegraf `Bot`.

- `senderId` = `"telegram:" + ctx.from.id`
- `content` = message text after command name
- `reply()` = `ctx.reply()`
- `sendMessage()` = `bot.telegram.sendMessage(chatId, text)`
- Configured via `TELEGRAM_BOT_TOKEN`, `TELEGRAM_OWNER_IDS`

### File Structure

```
src/
  platform/
    MessagingPlatform.ts      # Interface + MessageContext types
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

### Monitor Routing

`WatchMonitor` and `StrategyMonitor` change from calling `agent.createDmWithAddress()` directly to:

1. Look up `userId` from the watch/strategy's account
2. Determine platform from prefix
3. Call `sendMessage(userId, alertText)` on the correct `MessagingPlatform`

Monitors receive a lookup structure (e.g., `Map<string, MessagingPlatform>` keyed by platform prefix) to resolve the right platform from a userId.

## Server Orchestration

`startServer.ts` becomes the orchestrator:

1. Initialize database
2. Create platform instances based on env vars:
   - `XMTP_ENV` set → `XmtpPlatform`
   - `TELEGRAM_BOT_TOKEN` set → `TelegramPlatform`
   - Both → both start
3. Register same 18 commands on all active platforms via shared helper
4. Pass active platforms to monitors for alert routing
5. Start all platforms
6. Handle graceful shutdown for all platforms

### Command Registration

```typescript
function registerCommands(platform: MessagingPlatform) {
  platform.registerCommand('accountAdd', async (ctx) => {
    const result = await accountAdd(ctx.content, ctx.senderId);
    await ctx.reply(result);
  });
  // ... same for all other commands
}
```

### Middleware

Each platform applies its own owner middleware internally:
- `XmtpPlatform` checks `XMTP_OWNER_ADDRESSES`
- `TelegramPlatform` checks `TELEGRAM_OWNER_IDS`

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
