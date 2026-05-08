# Broker / Exchange Integration Template

This is the house style for adding a new broker or exchange to the package. The Alpaca integration under `src/exchange/alpaca/` is the canonical reference; the older sibling projects [`coinbase-pro-node`](https://github.com/bennycode/coinbase-pro-node), [`trading212-api`](https://github.com/bennycode/trading212-api), and [`ig-trading-api`](https://github.com/bennycode/ig-trading-api) follow the same recipe with minor variations.

## Layered architecture

Each layer has one job and exposes the smallest surface needed by the layer above. You can replace any layer without touching the others — that's the property worth protecting.

```
Strategy
  ↓ uses domain types
Exchange (neutral interface in Exchange.ts)
  ↓ uses mapper
Mapper (wire ↔ neutral types)
  ↓ uses validated data
Schema (zod, parses at the boundary)
  ↓ uses raw response
API class (one method per endpoint)
  ↓ uses configured client
RESTClient / WebSocket manager (auth, retries, reconnect)
  ↓ uses transport
axios / native WebSocket
```

## Outer composition root

Every broker has a thin outer class that owns `rest` + `ws`/`stream`, exposes environment selection, and holds no business logic. Static `URL_DEMO` / `URL_LIVE` (or `SETUP.PRODUCTION` / `SETUP.SANDBOX`) constants on the class.

## REST tier

- `axios.create({baseURL})` once per logical host. Multi-host brokers (e.g. Alpaca's trading vs. market-data) get one instance per host, sharing the same retry config.
- Wrap with `axiosRetry(client, { retries: Infinity, retryCondition, retryDelay })`.
- **Linear backoff:** `retryDelay: retryCount => retryCount * 1_000`. Prefer this over exponential unless the vendor docs require otherwise.
- **`retryCondition`:** retry on network errors + HTTP 429 + vendor-specific transient codes. Short-circuit permanent business errors (auth failed, plan-required, PDT violation, shorting forbidden, etc.) so they fail fast.
- **Type predicates over `as` casts** when narrowing `AxiosError`. Pattern: `function hasErrorCode(e: AxiosError): e is AxiosError<{code: number}>`.
- **Auth via request interceptor** (`httpClient.interceptors.request.use(...)`). More flexible than baked-in headers — supports token refresh, signing, clock skew. Auto-recovery (refresh token, re-login) belongs inside `retryCondition`.
- **Expose `defaults` and `interceptors` getters** so callers can layer logging/tracing/extra retries without subclassing.
- **Per-endpoint retry-delay tables must match paginated URLs.** When a vendor's rate limit is per-endpoint (e.g. 1 req / 60s), use `startsWith` / prefix matching against the request URL so cursor-paginated follow-ups (`?cursor=…`) hit the same calibrated wait instead of busy-looping the default delay.
- **`.env.defaults` selects the safe environment.** Default the `USE_PAPER` / `USE_SANDBOX` flag to `true` so a populated live API key alone does not fire orders on a real account.

## API classes (skip when a quality vendor SDK exists)

- **Skip the `XxxAPI` layer** when the vendor ships a typed, validated SDK and you don't need to override retry/validation. If wrapping it would just be `return sdk.foo(params)` for every method, call the SDK directly from `XxxExchange`.
- **Build the layer** when the SDK is missing/stale/untyped/browser-only, or you need zod parsing as a hard boundary.
- One method per endpoint, named after the operation, with a `@see` JSDoc URL to the vendor docs.
- Methods are thin: parse params → call axios → parse response. No business logic.
- API classes take the shared axios instance in their constructor.
- `static URL` constants (`OrderAPI.URL.ORDERS`) instead of scattered string literals — gives one rename point and lets retry-delay tables key off them safely.

## Schema validation

- **`z.looseObject()`** so vendors adding fields don't break parsing.
- Schemas live in `api/schema/` next to the API class.
- Export a named type alias alongside each schema: `export type Bar = z.infer<typeof BarSchema>`. Consumers import the type, not `z.infer`.
- **No explicit return types** on `Schema.parse()`-returning methods — let inference do the work.

## Mapper layer

- A dedicated `XxxExchangeMapper` translates wire format ↔ neutral domain types (`ExchangeCandle`, `ExchangeFill`, `ExchangePendingOrder`, etc.).
- The Exchange class never reaches into wire-format fields directly.
- Pays off the moment the vendor changes a field or you add a second broker.

### Mapper invariants

- **`size` is unsigned in neutral types; direction lives in `side`.** Wrap signed wire quantities in `Math.abs` so a SELL doesn't surface as a negative size.
- **When the wire format has multiple representations of the same order** (e.g. quantity-strategy vs value-strategy: `quantity` / `filledQuantity` vs `value` / `orderedValue` / `filledValue`), fall back across all sources and derive `side` from whichever signed field is populated. Assuming one representation mis-classifies orders placed via the other path as 0-size.
- **Filter, don't coerce.** If the broker returns order types outside the neutral enum (`STOP`, `STOP_LIMIT` when only MARKET/LIMIT are modelled), drop them. Silently downgrading loses fields like `stopPrice` and lies about the type.
- **Fee asset is the account currency, not `pair.counter`.** Brokers debit FX/duty fees in the account's base currency, which differs from the instrument's quote currency on cross-currency accounts. Pass the account `currencyCode` (from `getAccountInfo`) into the mapper.

## Streaming tier

- **Native `WebSocket`** (Node 22+). No `ws` dependency.
- Wrap the connection in an `EventEmitter` subclass (`XxxStream`).
- Authentication gate: an `#authenticated` flag, with `subscribe()` throwing if called too early instead of silently dropping.
- A separate manager class (`XxxWebSocket`) sits on top of the stream class to handle:
  - Connection lifecycle and reconnect.
  - Singleton-per-credential connections when the broker caps concurrent sockets.
  - Multi-subscriber multiplexing via a per-connection symbol set, full-set resubscribe pattern.
  - Retry policy via `ts-retry-promise` with a curated _non-retryable_ code set rather than a retryable one.
- Module-level singleton export (`export const alpacaWebSocket = new AlpacaWebSocket()`). Callers don't manage lifecycles.

## The neutral `Exchange` base

- `Exchange` covers **brokerage capabilities only** — orders, fills, balances, trading rules, fee rates, order-stream watchers. Market data lives in a separate `MarketDataSource` abstract class.
- **Every broker class takes a mandatory `marketData: MarketDataSource` in its constructor** and delegates candle methods (`getCandles`, `getLatestCandle`, `watchCandles`, `unwatchCandles`) to it. There is no "optional, throws if missing" path — the contract is honest at the type level. Brokers that ship their own data (Alpaca) construct a default `AlpacaMarketData` inside `getAlpacaClient`; brokers without their own (Trading212) require the caller to pass one.
- The market-data class is independent: `AlpacaMarketData extends MarketDataSource` lives next to `AlpacaExchange` but can be instantiated alone (`getAlpacaMarketData`) and re-used as the data source for any other broker. The same instance can feed multiple brokers.
- Lifecycle of the market-data source is owned by **whoever constructed it**. A broker's `disconnect()` does not close an injected data source — only the trading-side connections it owns directly. `getAlpacaClient` distinguishes between a caller-injected source (don't close) and an internally-constructed one (close on SIGINT).
- Strategies depend on `Exchange`, `MarketDataSource`, or `Exchange & MarketDataSource` — never on a concrete broker class.
- Domain types (`ExchangeCandle`, `ExchangeFill`, `ExchangePendingOrder`, `ExchangeBalance`, `ExchangeTradingRules`, `ExchangeFeeRate`, `ExchangeOrderSide/Type/Position`) are broker-neutral. Resist leaking vendor fields into them.
- `disconnect()` is the single shutdown seam — every async resource the class owns is reachable from one method.
- `getSmallestInterval()` + `CandleBatcher`: when the wire format has a fixed granularity (e.g. 1-minute bars only), expose it honestly and aggregate locally rather than pretending the broker streams what it doesn't.

## Subscription handles

- `watchX()` returns a UUID `topicId`.
- Use it as both the EventEmitter event name and the unsubscribe handle.
- Caller never sees vendor subscription IDs.
- Track `topicId → metadata` in a `Map` so `unwatchX()` can clean up listeners and remote subscriptions in one place.

## Probe, don't configure

When the broker can already tell us something, don't ask the caller. `#isCryptoSymbol` probes the crypto endpoint and treats 4xx as "not crypto" instead of requiring an `assetClass` param. Same idea wherever a broker has multiple asset classes with different endpoints.

## Code organization

- **Per-resource folders, not per-layer folders.** `account/`, `order/`, `fill/` each contain the API class + types + tests + `index.ts` barrel. Beats top-level `controllers/`, `types/`, `tests/` splits.
- `index.ts` re-export barrels at every directory level so consumers import from the package root.
- `demo/` directory with runnable scripts loaded via `dotenv-defaults` for manual smoke tests against real credentials.
- Test exchange logins with the project's own API classes, not raw `curl`/`fetch`.

## Things deliberately absent

These are not in any of the reference implementations and should stay out:

- No DI framework. Plain constructors and module singletons.
- No custom error class hierarchy. Axios errors + vendor codes are enough.
- No abstract "Connection" / "Transport" interfaces. WebSocket is just WebSocket.
- No global state besides connection-manager singletons.
- No big resilience frameworks. `axios-retry` and `ts-retry-promise` are small and focused — keep it that way.

## Checklist for adding a new broker

1. Subclass `Exchange`, leave method bodies as `throw new Error('not implemented')`.
2. If no good vendor SDK: build `XxxAPI` with zod schemas + axios-retry, one method per endpoint with `@see` links.
3. Build `XxxExchangeMapper` (wire → neutral types).
4. Wire REST methods first (`getCandles`, `listBalances`, `placeOrder`, …) and write the test file alongside.
5. Add `XxxStream` (native WebSocket) + `XxxWebSocket` manager only when REST is green.
6. Register the broker in the factory (`getExchangeClient` or equivalent).
