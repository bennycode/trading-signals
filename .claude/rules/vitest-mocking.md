# Vitest Module Mocking

## Type every `vi.fn()` that feeds data into the code under test

The `no-unsafe-*` lint rules catch an untyped mock's `any` when it is _read_ (destructured calls, member access, returns). They cannot catch the input side: `vi.fn().mockResolvedValue(wrongShape)` silently feeds garbage into the code under test as if it were typed data. So any `vi.fn()` whose return value the code consumes — `mockResolvedValue`, `mockReturnValue`, `mockImplementation` with a payload — must carry its real signature.

```ts
// ❌ Bad: payload is unchecked — a wrong shape passes the type checker
const getBalances = vi.fn().mockResolvedValue({basee: new Big(1)});

// ✅ Good: signature makes the payload compiler-checked
const getBalances = vi.fn<AlpacaBroker['getAvailableBalances']>().mockResolvedValue({
  base: new Big(1),
  counter: new Big(5000),
});
```

Derive the signature instead of hand-writing it: `SomeType['method']`, `typeof SomeClass.staticMethod`, or `NonNullable<SomeType['optionalMethod']>`. A bare `vi.fn()` remains fine for pure call-recording sinks (`toHaveBeenCalledTimes` and friends) where no data flows in either direction.

## Always use the typed `import()` form

Never pass a string path to `vi.mock` — pass the module via `import()`. The factory is then checked against the real module's shape, so a renamed or removed export fails at type-check instead of at runtime, and `importOriginal` is fully typed (no generics needed).

```ts
// ❌ Bad: untyped — a renamed export only fails at runtime
vi.mock('./getBrokerClient.js', () => ({
  getBrokerClient: vi.fn(),
}));

// ❌ Bad: untyped importOriginal needs a hand-written generic
vi.mock('trading-strategies', async importActual => {
  const actual = await importActual<Record<string, unknown>>();
  return {...actual, createStrategy: vi.fn()};
});

// ✅ Good: export names are compiler-checked, importActual is typed
vi.mock(import('./getBrokerClient.js'), () => ({
  getBrokerClient: vi.fn() as unknown as typeof getBrokerClient,
}));

vi.mock(import('trading-strategies'), async importActual => {
  const actual = await importActual();
  return {...actual, createStrategy: vi.fn() as unknown as typeof createStrategy};
});
```

## Prefer a bare automock when the test only needs stubs

`vi.mock(import('...'))` without a factory replaces every export with a typed `vi.fn()` returning `undefined` — no casts, no hand-rolled object. Use it whenever the test never asserts on specific return values.

```ts
// ❌ Bad: hand-written factory that recreates what automock generates
vi.mock(import('@grammyjs/auto-retry'), () => ({
  autoRetry: vi.fn(() => vi.fn()),
}));

// ✅ Good: bare automock
vi.mock(import('@grammyjs/auto-retry'));
```

Caveat: automock **imports the real module** to discover its exports. Only use it when that import is side-effect-free.

## Use a factory when the real module must not execute

Database models (Sequelize registration), the logger (pino setup), and anything else with import side effects must be mocked with a factory — the factory prevents the original module from loading at all.

```ts
// ✅ Good: factory keeps the Sequelize model module from executing
vi.mock(import('../database/models/Account.js'), () => ({
  Account: mockAccountModel as unknown as typeof Account,
}));
```

A factory is also required when the mock carries behavior the test drives or asserts on (canned return values, captured callbacks, stub classes).

## Cast partial mocks per export, as narrowly as possible

A partial stand-in (a stub class, a model with only `findByPk`) will not satisfy the real type — cast it with `as unknown as typeof X` on the **individual export**, never on the whole factory return. That way the export names stay compiler-checked and only the member shape is loosened. Use `import type` for the referenced types so nothing real is loaded.

```ts
// ❌ Bad: whole-module cast disables export-name checking
vi.mock(import('./api/AlpacaAPI.js'), () => ({mockedStuff}) as unknown as typeof import('./api/AlpacaAPI.js'));

// ✅ Good: narrow cast per export
import type {AlpacaAPI} from './api/AlpacaAPI.js';

vi.mock(import('./api/AlpacaAPI.js'), () => ({
  AlpacaAPI: class {
    getAccount = mockMethods.getAccount;
  } as unknown as typeof AlpacaAPI,
}));
```

Mocked constants must match their literal types exactly (e.g. `MESSAGE_BREAK: '\f' as const`) — the typed factory will flag a widened `string`.

## No manual mock restoration

`restoreMocks: true` is enabled in `vitest.shared.ts`, so spies created with `vi.spyOn` are restored automatically before each test. Do not add `vi.restoreAllMocks()` in `afterEach`.
