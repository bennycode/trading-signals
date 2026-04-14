# GuardedStrategy

An abstract base class that adds composable **kill-switch** behaviour (stop-loss and take-profit) to any trading strategy. New strategies opt in by extending `GuardedStrategy` instead of `Strategy` and calling `super.processCandle()` at the top of their own `processCandle` — if a guard fires, the subclass returns immediately; otherwise it runs its own logic.

`GuardedStrategy` does not decide what to trade. It only enforces exit conditions on positions built by a subclass.

## How it works

| Phase        | Action                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **active**   | Tracks position cost basis via `onFill`. On each candle, checks whether any configured guard has tripped.                        |
| **tripped**  | A guard has fired. Emits a `LIMIT SELL` advice at the nominal target price. The subclass is not called.                         |
| **retrying** | Still tripped, position not yet fully exited. Keeps re-emitting the same limit advice on every candle until `onFill` clears it. |
| **closed**   | Position fully exited via `onFill`. `onCandle` returns `void` for the rest of the session. Truly terminal.                      |

The kill switch is one-way: once tripped, the subclass never runs again. `GuardedStrategy` does not re-arm.

## Configuration

All six fields are optional strings validated by the existing `positiveNumberString` validator. Stop-loss and take-profit are independent — you can configure both, either, or neither. Within each direction the three variants are **mutually exclusive** (setting more than one throws at construction).

### Stop-loss (pick at most one)

| Parameter         | Meaning                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `stopLossPct`     | Percentage of avg entry. `"5"` → limit sell at `avgEntry * 0.95`.                                                     |
| `stopLossNominal` | Absolute unrealized loss in counter currency. `"10"` on 10 shares @ $100 → limit sell at $99 (net $10 loss).          |
| `stopLossPrice`   | Absolute price target. `"95"` → limit sell at $95 regardless of avg entry. Fires as soon as the candle close ≤ $95.  |

### Take-profit (pick at most one)

| Parameter           | Meaning                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `takeProfitPct`     | Percentage of avg entry. `"10"` → limit sell at `avgEntry * 1.10`.                                                    |
| `takeProfitNominal` | Absolute unrealized gain in counter currency. `"10"` on 10 shares @ $100 → limit sell at $101 (net $10 gain).         |
| `takeProfitPrice`   | Absolute price target. `"108"` → limit sell at $108 regardless of avg entry. Fires as soon as the candle close ≥ $108. |

Cross-direction mixing is allowed, e.g. `{ stopLossPct: "5", takeProfitNominal: "10" }`.

## Usage

Extend the base class and merge `GuardedStrategySchema` with your own config schema:

```typescript
import {z} from 'zod';
import {GuardedStrategy, GuardedStrategySchema} from '@typedtrader/trading-strategies';

const MyStrategySchema = GuardedStrategySchema.extend({
  mySetting: z.string(),
});

type MyStrategyConfig = z.infer<typeof MyStrategySchema>;

export class MyStrategy extends GuardedStrategy {
  static override NAME = '@typedtrader/strategy-my-strategy';

  constructor(config: MyStrategyConfig) {
    super({config, state: {/* subclass-specific fields */}});
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

## Limit prices

Guards always emit **limit orders at the nominal target price**, not market orders at the current candle close. The nominal target is computed from the configured variant:

| Variant              | Target formula                                 |
| -------------------- | ---------------------------------------------- |
| `stopLossPct`        | `avgEntry * (1 - stopLossPct/100)`             |
| `stopLossNominal`    | `avgEntry - (stopLossNominal / positionSize)`  |
| `stopLossPrice`      | `stopLossPrice`                                |
| `takeProfitPct`      | `avgEntry * (1 + takeProfitPct/100)`           |
| `takeProfitNominal`  | `avgEntry + (takeProfitNominal / positionSize)`|
| `takeProfitPrice`    | `takeProfitPrice`                              |

The target is stored in `killedLimitPrice` on the guard state so retries and post-restore sessions re-emit the same advice without recomputing.

### Important trade-off for stop-loss

Because the kill switch uses **limit** orders rather than market orders, a fast-moving drop can gap *past* the stop-loss target. In that case the limit sits on the book waiting for price to come back up to the target and may never fill. This caps your exit at exactly the configured loss — at the cost of occasionally not exiting at all in a crash. For take-profit the same mechanic is natural: you want to sell at your target, not at whatever the market happens to be.

If you need hard guaranteed exit in any market condition, use market orders in the subclass logic and don't rely on the kill switch alone.

## State persistence

Guard state is stored under a reserved `__guard` key inside the strategy's proxied state, alongside any subclass-specific fields. Updates go through a private helper that reassigns `state.__guard` as a new object on every change, triggering the base `Strategy` Proxy's `set` trap, which fires `onSave`, which `StrategyMonitor` persists to the database.

Persisted guard state:

```typescript
{
  killed: boolean;          // has a guard fired?
  killedReason: string | null;
  killedLimitPrice: string | null;  // the target limit price for retries
  totalCostBasis: string;
  totalPositionSize: string;
}
```

`restoreState` is override-safe — if legacy state is restored without a `__guard` key, the guard is reset to defaults rather than crashing.
