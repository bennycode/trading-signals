# Exchange Package

## CLI — use this instead of writing demo scripts

The package ships a broker-generic CLI (`src/cli/`) that covers account inspection and the full order lifecycle through the real composition root (`getBrokerClient`), so every invocation also exercises the production path:

```sh
npm run cli -- help
npm run cli -- balances --broker trading212
npm run cli -- instruments rolls-royce --broker trading212
npm run cli -- quote RRl_EQ --broker trading212 --counter GBX
npm run cli -- buy RRl_EQ 1 --broker trading212 --limit 1000 --dry-run
npm run cli -- buy RRl_EQ 1 --broker trading212 --limit 1000
npm run cli -- wait RRl_EQ <orderId> --broker trading212 --counter GBX --timeout 5m
npm run cli -- orders RRl_EQ --broker trading212 --counter GBX
npm run cli -- cancel RRl_EQ <orderId> --broker trading212 --counter GBX
npm run cli -- watch-candles ETH --broker alpaca --counter USD --take 3
```

- Paper by default; `--live` targets the real account.
- Output is JSON on stdout; errors (including the broker's `/api-errors/...` problem types) go to stderr with exit code 1.
- `--counter <currency>` skips the instrument lookup Trading212 otherwise needs to resolve the pair (its metadata endpoint is heavily rate-limited).
- **One `watch-*` at a time per Alpaca key:** Alpaca allows a single market-data WebSocket per API key; a second connection makes the server close the first (whose crash-restart handler exits 1). The CLI enforces this with a per-key process lock on this machine — a second stream fails fast naming the holding PID. Consumers on other machines (e.g. a deployed bot sharing the keys) can't be locked out: pass `--idle <duration>` so a silently starved stream fails with a diagnostic instead of hanging.

Only write a one-off script under `src/<exchange>/demo/` when the CLI can't express the call (and delete it afterwards); extend the CLI when the gap is generic.

For the full architectural template (layering, outer composition root, mapper layer, streaming manager, neutral `Exchange` base, etc.), see [BROKER_TEMPLATE.md](./BROKER_TEMPLATE.md). The notes below are a condensed checklist.

## Design Decisions

The `Broker` interface is intentionally kept generic so that any broker can implement it:

- **Bring your own broker.** Alpaca and Trading212 are first-class, but the package is built to be extended.
- **Extending the abstract `Broker` class** makes an integration plug straight into the `trading-strategies` package's `TradingSession` for live strategies and `BacktestExecutor` for backtesting — both for free, with no extra wiring.
- **Execution and market data are deliberately separated.** `Broker` handles order execution; `MarketDataSource` handles candles. This lets any data provider be paired with any broker — essential for brokers without a market-data API (e.g. Trading212, which exposes no historical bars and no WebSocket, so `Trading212Broker` requires an external `MarketDataSource`).

The README is written for end users (installation, quick starts, broker trade-offs) — keep architectural rationale here or in BROKER_TEMPLATE.md, not there.

## Exchange Implementation Patterns

When implementing an exchange integration, follow these patterns:

### HTTP Client

- Use `axios` with `axios-retry` for reliable network communication
- Handle network errors (e.g., `EAI_AGAIN`) and rate limits (e.g., HTTP 429)
- Configure retry delays based on exchange-specific rate limit documentation

### Environments

- Support both paper trading (sandbox) and live trading environments
- Use environment-specific API endpoints and credentials

### Validation

- Use `zod` schemas for all API responses
- Use `z.looseObject()` instead of `z.object()` so additional properties don't cause validation failures
- Place schemas in dedicated files under `api/schema/` (e.g., `ClockSchema.ts`)
- Export a named type alias alongside each schema (e.g., `export type Bar = z.infer<typeof BarSchema>`) — consumers import the type, not `z.infer`
- Define schemas with proper datetime parsing
- Validate both request and response data
- Rely on type inference for function return types as `Schema.parse()` from zod already returns safe typings, so explicit return type annotations are unnecessary and harder to maintain

### Type Safety

- Prefer type guards / type predicates over type castings (`as`)
- Use `is` return types to narrow types safely (e.g., `error is AxiosError<{code: number}>`)
- Validate unknown data shapes with runtime checks (`typeof`, `in` operator) rather than assertions

### WebSocket

- Use Node.js native `WebSocket` (stable since v22.4.0)

### Documentation

- Always add a `@see` JSDoc comment with the API reference URL to every API method (e.g., `/** @see https://docs.alpaca.markets/reference/stockbars */`)

### Testing Credentials

- Always test exchange logins by using the library's own API classes (e.g., `AlpacaAPI`) with credentials from `.env`
- Do not use raw `curl` or `fetch` calls — use the existing exchange client code to verify connectivity

### Structure

- Exchange integrations live under `src/<exchange>/` (e.g., `src/alpaca/`)
- API clients and schemas go under `src/<exchange>/api/` and `src/<exchange>/api/schema/`
- Separate API classes by domain (e.g., Account, Orders, Market Data, Portfolio)
- Implement a common interface for cross-exchange compatibility in `Exchange.ts`
