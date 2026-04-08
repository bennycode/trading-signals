# ScalpStrategy

A scalping strategy that enters on short-term EMA momentum and then ping-pongs limit orders at a fixed offset above and below each fill price.

## How it works

| Phase | Action |
| --- | --- |
| **entry** | Feeds 1-minute candles into a short EMA. When price closes above the EMA, fires a market BUY. |
| **pendingAdvice** | After a fill, places a limit order on the opposite side at `fill_price +/- offset`. |
| **waitingForFill** | Sits idle until the limit order fills, then loops back to pendingAdvice. |

## Configuration

| Parameter | Required | Default | Description |
| --- | --- | --- | --- |
| `offset` | No | Auto-computed | Price offset per leg (e.g. `"2.00"` means sell at fill+2, re-buy at fill-2). When omitted, computed from daily ATR during `init()`. |
| `emaPeriod` | No | `5` | EMA period for the initial entry filter. |

### Auto-offset

When no `offset` is provided, calling `init()` with historical candles will auto-compute one using `suggestScalpOffset()`. This function aggregates candles to daily bars (regardless of input interval) and returns `ATR(14) * 0.2`. The computation takes <5ms even on 20k+ candles.

## When to use it

This strategy works best on **choppy, range-bound stocks** with high intraday volatility but no strong directional trend. Characteristics to look for:

- High daily ATR relative to price (>2%)
- Frequent direction reversals (>40% of days)
- Net price change much smaller than the trading range over the same period

## Case study: AMD (Jan-Apr 2026)

AMD exhibited textbook choppy behavior over Q1 2026:

- **Price range:** $191 - $260 (36% range)
- **Net change:** +7% (most of the range was noise)
- **Daily ATR:** $10.04 (4.6% of price)
- **Reversal rate:** 44% of days flipped direction

### Weekly price action

```
2026-01-08 | $210 → $203 (-3.4%) ▼
2026-01-12 | $201 → $232 (+15.2%) ▲
2026-01-20 | $226 → $260 (+14.8%) ▲
2026-01-26 | $257 → $237 (-7.8%) ▼
2026-02-02 | $236 → $208 (-11.7%) ▼
2026-02-09 | $207 → $207 (+0.2%) ▲
2026-02-17 | $202 → $200 (-1.0%) ▼
2026-02-23 | $198 → $200 (+1.1%) ▲
2026-03-02 | $194 → $192 (-0.7%) ▼
2026-03-09 | $189 → $193 (+2.2%) ▲
2026-03-16 | $195 → $201 (+3.3%) ▲
2026-03-23 | $206 → $202 (-2.2%) ▼
2026-03-30 | $205 → $218 (+6.1%) ▲
2026-04-06 | $219 → $219 (-0.2%) ▼
```

### Backtest results ($10,000 starting capital, commission-free)

| Offset | Source | Trades | Win Rate | Return | P&L |
| --- | --- | --- | --- | --- | --- |
| **$2.04** | **Auto (ATR)** | **30** | **100%** | **+17.1%** | **+$1,713** |
| $1.00 | Manual | 42 | 100% | +13.6% | +$1,361 |
| $2.00 | Manual | 30 | 100% | +16.9% | +$1,693 |
| $3.00 | Manual | 20 | 100% | +16.9% | +$1,690 |
| $5.00 | Manual | 14 | 100% | +15.6% | +$1,561 |
| _Buy & hold_ | _Baseline_ | _1_ | - | _+5.5%_ | _+$552_ |

The auto-computed offset ($2.04, from daily ATR x 0.2) landed at the optimal point and beat every manually-tuned value.

### Running the backtest

```bash
npm run backtest -- \
  --data src/backtest/candles/AMD_USD_2026_Q1_3_months.json \
  --strategy '@typedtrader/strategy-scalp'
```

## When NOT to use it: INTC (Jan-Apr 2026)

INTC over the same Q1 2026 period shows why stock characteristics matter. While the auto-offset configured correctly ($0.58, proportional to INTC's ~$45 price), the strategy underperformed because INTC was **trending, not choppy:**

- **Price range:** $40 - $55 (35% range, similar to AMD)
- **Net change:** +31% (most of the range was directional movement)
- **Reversal rate:** 52% of days (frequent reversals, but within a strong uptrend)

### Backtest comparison ($10,000 starting capital, commission-free)

| Metric | INTC | AMD |
| --- | --- | --- |
| Auto offset | $0.58 | $2.04 |
| Trades | 8 | 30 |
| Scalp return | +5.8% | +17.1% |
| Buy & hold | +30.9% | +5.5% |
| **Winner** | **Buy & hold** | **Scalp** |

The strategy kept selling into the uptrend and re-buying slightly lower, capturing only small oscillations while missing the bulk of the 31% rally. A simple buy-and-hold returned 5x more on INTC.

**The auto-offset finds a good price level for any stock, but it cannot change the fact that scalping is the wrong strategy for a trending stock.** Choosing the right strategy for the market regime matters more than tuning parameters.

```bash
npm run backtest -- \
  --data src/backtest/candles/INTC_USD_2026_Q1_3_months.json \
  --strategy '@typedtrader/strategy-scalp'
```

## Considerations for stocks

- **Market hours:** Stocks only trade 9:30 AM - 4:00 PM ET. No candles flow outside these hours.
- **PDT rule:** Accounts under $25k are limited to 3 day trades in 5 rolling business days. A $1 offset can burn through these quickly.
- **Commissions:** Alpaca is commission-free for US stocks, so the offset only needs to exceed the bid-ask spread. On exchanges with fees, the offset must also cover round-trip commission costs.
