# ProtectedStrategy

An abstract base class that adds composable **kill-switch** behaviour (stop-loss and take-profit) to any trading strategy. New strategies opt in by extending `ProtectedStrategy` instead of `Strategy` and calling `super.processCandle()` at the top of their own `processCandle` — if a guard fires, the subclass returns immediately; otherwise it runs its own logic.

`ProtectedStrategy` does not decide what to trade. It only enforces exit conditions on positions built by a subclass.

## How it works

| Phase | Action |
| --- | --- |
| **active** | Tracks position cost basis via `onFill`. On each candle, checks whether any configured guard has tripped. |
| **tripped** | A guard has fired. Emits a `SELL` advice — `LIMIT` at the nominal target price or `MARKET`, depending on `stopLossOrder` / `takeProfitOrder`. The subclass is not called. |
| **retrying** | Still tripped, position not yet fully exited. Keeps re-emitting the same advice on every candle until `onFill` clears it. |
| **closed** | Position fully exited via `onFill`. `onCandle` returns `void` for the rest of the session. Truly terminal. |

The kill switch is one-way: once tripped, the subclass never runs again. `ProtectedStrategy` does not re-arm.

## Configuration

All kill-switch settings live under a single nested `protected` key on the strategy config so they can't collide with subclass-specific fields:

```json
{
  "protected": {
    "stopLossPct": "5",
    "stopLossOrder": "market",
    "takeProfitNominal": "10"
  },
  "mySubclassField": "whatever your strategy needs"
}
```

Stop-loss and take-profit are independent — you can configure both, either, or neither. Within each direction the three **trigger** variants are mutually exclusive (setting more than one throws at construction); the **order type** selects how the kill switch executes the exit. Omitting the `protected` key entirely disables both guards.

### Stop-loss trigger (pick at most one)

| Parameter | Meaning |
| --- | --- |
| `stopLossPct` | Percentage of avg entry. `"5"` → fires when price drops to `avgEntry * 0.95`. |
| `stopLossNominal` | Absolute unrealized loss in counter currency. `"10"` on 10 shares @ $100 → fires at $99 (net $10 loss). |
| `stopLossPrice` | Absolute price target. `"95"` → fires as soon as the candle close ≤ $95, regardless of avg entry. |

### Take-profit trigger (pick at most one)

| Parameter | Meaning |
| --- | --- |
| `takeProfitPct` | Percentage of avg entry. `"10"` → fires when price reaches `avgEntry * 1.10`. |
| `takeProfitNominal` | Absolute unrealized gain in counter currency. `"10"` on 10 shares @ $100 → fires at $101 (net $10 gain). |
| `takeProfitPrice` | Absolute price target. `"108"` → fires as soon as the candle close ≥ $108, regardless of avg entry. |

### Order type

| Parameter | Default | Values | Meaning |
| --- | --- | --- | --- |
| `stopLossOrder` | `"limit"` | `"limit"` \| `"market"` | How the stop-loss exit is executed once the trigger fires. |
| `takeProfitOrder` | `"limit"` | `"limit"` \| `"market"` | How the take-profit exit is executed once the trigger fires. |

- **`"limit"`** (default) places a `LIMIT SELL` at the nominal target price. Guaranteed exit price, but may not fill if the market gaps past the target (especially for stop-loss). See the trade-off section below.
- **`"market"`** places a `MARKET SELL` on the candle where the trigger fires. Guaranteed fill (near-immediate on live exchanges), but the exit price depends on wherever the market is at that moment — potentially worse than the target.

Cross-direction mixing is allowed for both the trigger and the order type, e.g. `{ protected: { stopLossPct: "5", stopLossOrder: "market", takeProfitNominal: "10" } }` uses a market stop-loss with a limit take-profit.

## Usage

Extend the base class and merge `ProtectedStrategySchema` with your own config schema:

```typescript
import {z} from 'zod';
import {ProtectedStrategy, ProtectedStrategySchema} from '@typedtrader/trading-strategies';

const MyStrategySchema = ProtectedStrategySchema.extend({
  mySetting: z.string(),
});

type MyStrategyConfig = z.infer<typeof MyStrategySchema>;

export class MyStrategy extends ProtectedStrategy {
  static override NAME = '@typedtrader/strategy-my-strategy';

  constructor(config: MyStrategyConfig) {
    super({
      config,
      state: {
        /* subclass-specific fields */
      },
    });
  }

  protected override async processCandle(candle, state) {
    const guardAdvice = await super.processCandle(candle, state);
    if (guardAdvice) {
      return guardAdvice; // kill switch fired — return immediately
    }

    // subclass logic goes here
  }
}
```

`onFill` is inherited and handles position tracking automatically. If a subclass overrides `onFill` for its own state machine (e.g. `ScalpStrategy`), it must call `super.onFill(fill, state)` first so cost-basis tracking stays in sync.

## Position tracking

Cost basis is accumulated across every BUY fill and reduced proportionally on every SELL fill:

- `totalCostBasis` = Σ `(price * size)` for all BUYs
- `totalPositionSize` = BUY sizes − SELL sizes
- `avgEntryPrice` = `totalCostBasis / totalPositionSize`

This handles multi-tranche entries and partial exits correctly. After a partial sell, the average entry stays fixed (only the position size shrinks), so a percentage stop-loss still measures from the original cost basis.

## Trigger prices

The trigger fire condition is computed from the configured variant:

| Variant             | Target formula                                  |
| ------------------- | ----------------------------------------------- |
| `stopLossPct`       | `avgEntry * (1 - stopLossPct/100)`              |
| `stopLossNominal`   | `avgEntry - (stopLossNominal / positionSize)`   |
| `stopLossPrice`     | `stopLossPrice`                                 |
| `takeProfitPct`     | `avgEntry * (1 + takeProfitPct/100)`            |
| `takeProfitNominal` | `avgEntry + (takeProfitNominal / positionSize)` |
| `takeProfitPrice`   | `takeProfitPrice`                               |

Stop-loss fires when the candle close is ≤ the target; take-profit fires when it is ≥ the target.

When `stopLossOrder` / `takeProfitOrder` is `"limit"` (the default), the target price is also used as the limit price of the sell order, stored in `killedLimitPrice` on the guard state so retries and post-restore sessions re-emit the same advice without recomputing. When set to `"market"`, no limit price is stored and every retry emits a fresh market sell.

### Limit vs market: which should I use?

|  | Limit | Market |
| --- | --- | --- |
| **Fill guarantee** | May not fill if the market gaps past the target | Near-immediate on live exchanges |
| **Price guarantee** | Exits at exactly the configured target | Exits at whatever the market is at the fire candle |
| **Best for** | Take-profit (sell at your target or better) | Hard stop-loss that must exit in all conditions |

**For stop-loss specifically:** a fast-moving drop can gap _past_ the limit target, leaving the order sitting on the book waiting for the price to come back up. This caps your exit at exactly the configured loss — at the cost of occasionally not exiting at all in a crash. If a hard exit is required in all market conditions, set `stopLossOrder: "market"`.

**For take-profit:** limit is the natural choice. You want to sell at your target, not at whatever the market happens to be when the candle closes. `market` only makes sense if you'd rather guarantee the exit than guarantee the price.

## State persistence

Kill-switch state is stored under a reserved `protected` key inside the strategy's proxied state, alongside any subclass-specific fields — matching the `protected` namespace used for config. Updates go through a private helper that reassigns `state.protected` as a new object on every change, triggering the base `Strategy` Proxy's `set` trap, which fires `onSave`, which `StrategyMonitor` persists to the database.

Persisted protected state:

```typescript
{
  killed: boolean; // has a guard fired?
  killedReason: string | null;
  killedOrderType: 'limit' | 'market' | null; // which order type the kill switch uses
  killedLimitPrice: string | null; // target limit price for retries (null for market)
  totalCostBasis: string;
  totalPositionSize: string;
}
```

`restoreState` is override-safe — if legacy state is restored without a `protected` key, the kill-switch state is reset to defaults rather than crashing.
