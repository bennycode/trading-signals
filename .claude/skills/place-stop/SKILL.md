---
name: place-stop
description: Run pre-placement checks before setting or moving a protective stop on the live Trading212 account — anchor, expected firing rate, distance from the all-time high, reachable size, break-even side, and whether the ratchet rule permits the move. Use when asked to place, move, ratchet, tighten or widen a stop.
---

# Check a protective stop before placing it

`check.mts` prints the facts and places nothing. Run `op run --env-file=.env.op -- npx tsx .claude/skills/place-stop/check.mts <T212 ticker> <proposed stop> [atrMultiple]`, and `--selftest` for the arithmetic without network.

Every check below exists because its absence cost money in October and November 2026. Four stops were placed by hand; three fired within days, each on the deepest drawdown day of the month, and two of those names set all-time closing highs the next session.

## Name the anchor, always

A multiple without an anchor is not a specification. One stop at $278.98 on `NET` simultaneously read 1.84x ATR off its entry fill, 0.75x off the prior close and 5.42x off the running peak. It was in fact a flat `fill * 0.90` that was never ATR-derived, and it was described afterwards as though it had been. The script prints all three readings so the choice is explicit.

Watch for an entry fill well above the prior close. `NET` was bought 6.3% above the previous close on an intraday spike, so a stop that looked like a sane 1.84x below the fill sat 0.75x below where the stock was actually trading.

## The multiple is a firing-rate dial

Measured on `AAPL`, `MSFT`, `NET` and `CAT` across 7-11 years of daily bars, a trail at `m x ATR` fires roughly `30 / m` times a year, and the rate barely varies between instruments because ATR already cancels out each one's volatility:

| multiple | firings/year | roughly          |
| -------- | ------------ | ---------------- |
| 1x       | 30           | every 8 sessions |
| 2x       | 12           | monthly          |
| 3x       | 6            | every 2 months   |
| 4x       | 4            | quarterly        |
| 5x       | 3            | 3x/year          |

Match that to the holding horizon. `MSFT` was stopped out of a 156-day hold by a stop at 1.67x, which implies being hit about every three weeks. The mismatch, not a failed forecast, is what ended the position.

A breach also carries almost no predictive information. Forward 20-day returns after a 3x breach came out at +1.73% on `AAPL` against a +2.34% unconditional baseline, +2.91% vs +2.04% on `MSFT`, +2.45% vs +2.38% on `CAT`. So each firing is mostly a cost, not a signal — on the 2016-2026 sample, which is predominantly a rising market. In the 2022 bear window the same measurement in issue #1420 came out far lower, so a tight multiple earns its keep there.

## Check the distance from the all-time high

This is the one both of us missed. `AAPL` set six all-time-high closes in October 2026 and spent the month within 1.3% of a record; its deepest point all month was -4.88%, on the day its stop filled. `MSFT`'s record was 16 days before its stop fired. A 5-7% pullback from a record is ordinary, and reading it as deterioration is what made the exits look justified at the time.

Base rates worth knowing, from each name's own 10.8 years: from 5% below the all-time high a new high follows within 20 sessions about 29% of the time on `AAPL` and 39% on `MSFT`. Not predictable — but the point is that the pullback itself was unremarkable, not that the recovery was foreseeable.

## Size to what a pie leaves reachable

`quantity - pieQuantity` is what the orders endpoint will accept; above it, it rejects with `selling-equity-not-owned` and quotes the remainder. A partial pie is the common case — `AAPL` had 90.86 shares with 0.38 in a pie, so the full-size order failed and 90.48 went through.

## Say whether it protects a profit or caps a loss

`NET`'s stop sat 9.3% below break-even. Calling that a protective stop was wrong; it fixed a loss. The two are different instruments and should be described differently.

## Do not re-anchor an existing stop

The first batch was consistent at 3.30x and 3.31x off the prior close. Replacing them a day later moved `MSFT` to 1.67x and `AAPL` to 2.30x, because the replacement anchored to a running peak that `MSFT` had fallen $20 away from while `AAPL` had fallen only $8 — same operation, triple the effect.

The rule is `newStop = max(oldStop, price - m x ATR)`, and for `MSFT` it said not to move at all. A ratchet is one-way, so an over-tight level cannot be walked back later: it stays until price makes a real advance. Get it right once.

## Do not cover new shares with a stop that sits inside the noise

A `NET` top-up was bought 1.4x ATR above the already-resting stop and was liquidated the next day, after a one-day hold, contributing 46% of that position's loss. Before extending a stop over newly bought shares, state the gap in ATR units.

## Coverage limit

ATR and the all-time high come from Alpaca, which has no bars for non-US listings, so the script refuses anything but `*_US_EQ`. Trading212 publishes no bars of its own (verified: nine plausible paths all 404 against a 200 control) and supports no trailing stops (`trailingDistance` is rejected as `Invalid payload`; `POST /orders/trailing_stop` returns 405). A resting Trading212 stop is one fixed price, so any trailing means cancel-and-replace — with a window where nothing protects the position.

`initialFillDate` is the position's first ever fill, not the current tranche's, so the reported holding period runs long for a position that was topped up or partly sold. Replay the history when the exact figure matters.
