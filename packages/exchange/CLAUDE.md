# Exchange Package

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

### Structure

- Exchange integrations live under `src/<exchange>/` (e.g., `src/alpaca/`)
- API clients and schemas go under `src/<exchange>/api/` and `src/<exchange>/api/schema/`
- Separate API classes by domain (e.g., Account, Orders, Market Data, Portfolio)
- Implement a common interface for cross-exchange compatibility in `Exchange.ts`
