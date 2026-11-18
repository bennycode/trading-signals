# Protected

A strategy that is nothing but **kill switches**: a stop-loss and a take-profit, and no entry rule at all. It protects a position it did not open — bought by hand, by another strategy, or carried across a restart — and once it has sold, there is nothing that could buy back in.

The same two switches are available to any strategy: extend `ProtectionSchema` and add the `protection()` rule, which is what most strategies in this package do. The exceptions are `SmaCrossover`, which offers no kill switch, and `TrailingStop`, which is one.

```ts
import {defineStrategy, protection, ProtectionSchema} from '@typedtrader/trading-strategies';

const MyStrategySchema = ProtectionSchema.extend({
  dipBelow: positiveNumberString,
});
type Settings = z.output<typeof MyStrategySchema>;

export const MyStrategy = defineStrategy(MyStrategySchema)({
  long: {
    // A protective rule belongs first: rules are judged top to bottom and the first match wins.
    close: protection<Settings>(),
    open: {
      because: ({config}) => `price dipped below ${config.dipBelow}`,
      spend: 'all',
      when: ({candle, config}) => candle.close.lte(config.dipBelow),
    },
  },
  markets: [MarketType.BULLISH],
  name: '@typedtrader/strategy-my-strategy',
});
```

A kill switch is one-way. When one fires the engine keeps re-placing the exit until the position is gone, never opens again, and then tears the session down: a stop firing means the reason for holding was wrong.

## Configuration

Stop-loss and take-profit are independent, so configure both, either or neither. Setting none of the thresholds runs the strategy unprotected.

Each switch can be told where it fires in three equivalent units, of which exactly one may be set — they are one exit said in different ways, and a config that sets two is rejected.

| Setting | Where it fires |
| --- | --- |
| `stopLossPct` / `takeProfitPct` | Percent away from the average entry price. `"5"` on an entry at $100 → $95 (or $105). |
| `stopLossNominal` / `takeProfitNominal` | Counter currency away from it, spread over the position. `"10"` on 10 shares at $100 → $99. |
| `stopLossPrice` / `takeProfitPrice` | The price itself, wherever the position was entered. `"95"` → $95. |

The order each exit goes out as is configured per direction, and the two default differently:

| Setting           | Default    | Meaning                                                                     |
| ----------------- | ---------- | --------------------------------------------------------------------------- |
| `stopLossOrder`   | `"market"` | Takes whatever the market offers, so the exit always fills.                 |
| `takeProfitOrder` | `"limit"`  | Offers exactly the threshold, so the profit taken is the profit configured. |

`"limit"` caps what the exit gives up but can rest unfilled above a market that gapped straight through it, which is why a stop-loss does not default to it: a stop that may never fill is not a stop. A take-profit has nothing to lose by waiting for the price it was promised. Mixing is allowed, so `{"stopLossPct": "5", "stopLossOrder": "limit", "takeProfitNominal": "10"}` offers both exits as limits, one priced in percent and one in money.

```json
{
  "stopLossPct": "5",
  "takeProfitPct": "10"
}
```

## Thresholds are measured from the entry price

The percentage and nominal forms need to know what the position cost. The engine tracks that from the fills it sees, and for a position it did not open it adopts the balance it finds at the price of the candle it attached on. That attach price is a starting point, not a cost basis, so prefer `stopLossPrice` / `takeProfitPrice` when the real entry price matters and the position was opened elsewhere.
