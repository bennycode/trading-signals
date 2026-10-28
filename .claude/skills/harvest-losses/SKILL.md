---
name: harvest-losses
description: Cut every Trading212 position whose loss is under a threshold, then offset the realised loss by selling part of the smallest winner that can cover it alone. Use when asked to clean up small losing positions, harvest or realise losses, or balance realised losses against a winner.
---

# Harvest losses against the smallest capable winner

`plan.mts` in this folder does the selection and sizing and places nothing. Run `npx tsx .claude/skills/harvest-losses/plan.mts [thresholdEur]` with `op run --env-file=.env.op` so the live keys resolve, and `--selftest` to check the arithmetic without touching the network. Everything below is the part the script cannot enforce.

## Read `ppl`, never `ppl + fxPpl`

A position's `ppl` is the EUR result and already carries the currency move. `fxPpl` only breaks out how much of that result came from FX, so summing the two double-counts it. This is worth stating because the mistake is silent and large: on a USD position in a EUR account it inflated a 511 EUR loss to 426 EUR and a 805 EUR gain to 1155 EUR, which in turn produced a share count 40% too small.

Two cheap ways to catch it: account-level `ppl` from `/account/cash` equals the sum of the positions' `ppl`, and a realised fill reports a result that matches `ppl` alone.

## The real result is the difference between the `netValue`s

`walletImpact.netValue` on each fill is the actual EUR cash moved, fees included. Sale `netValue` minus the FIFO buy `netValue` is the figure that matters, and it is also what German tax wants, because each leg is already converted at its own day's rate.

T212's own `walletImpact.realisedProfitLoss` excludes transaction costs, so it reads smaller than the real loss. On the 2026-10-28 harvest it said -500.56 against an actual -508.47, the gap being 7.91 of conversion fees, stamp duty and French FTT.

## Cost basis comes from replaying the history, not from `averagePrice`

`averagePrice` blends every tranche, while a sale consumes them oldest first. Replay `getHistoryOrders(ticker)` into a FIFO queue, because a ticker that was fully exited and re-bought must not drag its old basis forward. Rolls-Royce had done this twice before leaving a 20 share remnant.

## Two stages, and size the offset from fills only

Sell the losers first, read the realised loss off the actual fills, and only then size the winner. Never size the offset from pre-trade estimates: the gain is roughly a tenth of the proceeds, so any error in the proceeds lands on the gain tenfold, and a 0.13% move in EUR/USD is already 1.3% of the answer.

Round the offset quantity down so the gain lands just under the loss. Leftover loss carries forward indefinitely; leftover gain is taxed now.

## Market orders, in the venue overlap

Use market orders. A limit order fixes only the quote, while the EUR conversion happens at fill time, so it leaves the dominant variable open and adds unbounded drift by decoupling the fill from the moment of sizing. An unfilled limit is the worst case of all: realised losses with no offsetting gain.

Trading212's 24/5 venue covers only instruments whose `extendedHours` is true, which in practice means US lines. London, Paris and Amsterdam positions trade in their own session, so run the whole thing in the 15:30 to 17:30 CET overlap when those and New York are all open. Quantity carries the side: negative sells.

## Positions the orders endpoint cannot touch

A holding inside an AutoInvest pie answers `selling-equity-not-owned, owned: 0.0` however much the portfolio says you own. Detect it with `pieQuantity` equal to `quantity` and `maxSell` null, report it, and tell the user to unwind that pie in the app rather than retrying.

## Confirm before placing, and do not pose as tax advice

Print the plan and let the user approve it. These are irreversible live orders, and the offset leg in particular tends to be larger than people expect: covering 508 EUR of losses took 9 of 14 Mastercard shares.

The script matches a loss total against a gain total and models no tax rules. German netting is more restrictive than that: losses on individual shares offset only gains on individual shares, equity fund losses are cut to 70% by Teilfreistellung, and a gold ETC may fall under section 23 instead of section 20, in which case its loss offsets nothing here. Say that the plan ignores these and belongs in front of a Steuerberater; never present the match as a tax outcome.
