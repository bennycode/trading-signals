# Quiet comeback: what was measured

Why this report is a watchlist and not a buy list. Daily bars, 2016-2026 (Alpaca's history starts 2016-01-04), split- and spin-off-adjusted. Three samples, each scored against its own month's universe so a result cannot come from market timing:

- **S&P 500 train** — first half of the period
- **S&P 500 test** — second half, unseen when thresholds were chosen
- **confirmation** — 113 liquid mid-caps, then 1,235 further symbols, none used in any fit

## The setup pays nothing

Entering on the setup returns what the market returns. The climb up to the level earns 2-3% over SPY, but only 20-30% of setups reach it and the rest hand that back. Cross rate times pre-cross gain is near-constant across entry distances, so no entry threshold improves the trade:

| entry gap | cross rate | pre-cross leg | post-cross leg | blended |
| --------- | ---------- | ------------- | -------------- | ------- |
| >-1.5%    | 55.9%      | +1.41%        | -0.36%         | -0.20%  |
| >-2.5%    | 42.6%      | +1.94%        | -0.13%         | +0.03%  |
| >-4%      | 29.4%      | +2.52%        | -0.05%         | +0.05%  |
| >-6%      | 19.7%      | +2.95%        | -0.05%         | 0.00%   |

The gains sit entirely in the climb **to** the level, visible only in hindsight once a stock has arrived. After the cross there is nothing, at every horizon from 5 days to a year, in all 16 configurations across both universes.

## Holding longer is worse

Across 24 exit and level variants — closing highs and intraday highs, a fixed 21-day exit, a three-ATR trail, a 20-day moving-average trail, and no time limit at all — the median trade trailed the market in every one, and the win rate fell as the hold lengthened, from 44% at 17 days to 38% at 41. With no time limit the excess was -0.84% and -1.07% per month (t = -2.53, -2.44). The move reverts, so an exit that leaves it room gives more back.

## Returns are not predictable here

A search over 12,786 rules (each requiring 150+ in-sample and 100+ out-of-sample setups) found plenty of 3-6% in-sample edges. The correlation between in-sample and out-of-sample edge across all of them was **-0.048**. The top 50 by in-sample edge averaged +3.03% in sample and -1.24% out.

## The crossing _is_ predictable, and it pays nothing

The biggest one-day rise in the grind window lifts the cross rate consistently:

| sample                        | without | with  |
| ----------------------------- | ------- | ----- |
| S&P test (unseen)             | 44.8%   | 51.3% |
| confirmation mid-caps         | 45.0%   | 52.2% |
| 1,235 fresh symbols (n=9,895) | 45.7%   | 53.3% |

Combined with a high 14-day ATR it reaches 54%. The in-sample to out-of-sample lift correlation across features and entry bands is **0.59**, against -0.05 when the same search targeted returns.

The return of the filtered group: +0.06%, -0.46% and +0.13% per month (t = 0.17, -0.62, 0.47). A wider daily range carries a stock over its level and just as readily back, so the higher hit rate collects nothing. This asymmetry — a reliable event predictor with no return attached — is the central finding.

## Closed avenues

Each tested as a single pre-specified hypothesis, not a search.

| avenue                                               | result                                            |
| ---------------------------------------------------- | ------------------------------------------------- |
| Insider buying (SEC Form 345, by filing date)        | net buyers **-2.27%, -3.02%**/mo (t -2.93, -3.67) |
| Short interest (FINRA Reg SHO, 424 weekly snapshots) | most-shorted quartile **-3.27%**/mo (t -3.59)     |
| Reported earnings (SEC XBRL, public at +60 days)     | up _and_ accelerating: -0.57%, -0.11%, -0.60%     |
| Momentum version (breakout from a tight base)        | **-1.7% to -3.2%** over 63d (t to -4.93)          |
| Stacked exclusions (all of the above as filters)     | +1.31% on 342 setups → **+0.09%** on 5,160        |

Only the downside ever replicated: deteriorating earnings cost -1.30%/mo (t = -4.10), slow recoveries -0.74% (t = -2.94). That is why {@link rankQuietComebacks} excludes laggards instead of ranking leaders.

The stacked-exclusion row is worth remembering. Three filters that each measured negative alone, stacked down to 342 observations, produced a significant-looking +1.31% per month (t = 2.32). Its price-only core reads -0.13% on the same half and +0.09% on 5,160 fresh setups. Two such mirages appeared during this work (+6.36% and +1.31%); both were caught only by out-of-sample checks.

## Parameters

Ablation on both universes. Returns are flat for every variant; only the cross rate moves, and barely:

| variant               | S&P cross | fresh cross |
| --------------------- | --------- | ----------- |
| full setup            | 41.7%     | 45.7%       |
| drop `minDrawdown`    | 41.6%     | 43.0%       |
| drop the grind filter | 40.1%     | 44.5%       |
| drop both             | 40.0%     | 41.0%       |
| `maxGapToLevel` 2%    | **63.6%** | **64.5%**   |

`maxGapToLevel` dominates, mechanically: the closer to the level, the likelier the cross and the less room left. Shortening `minQuietDays` from months to weeks leaves the return flat at every setting from 10 to 120 days while roughly doubling the candidates and raising the cross rate (41.7% → 42.8% on the S&P, 45.7% → 48.6% on the 1,235). Stocks that bottomed within the last two weeks reach their level most often of all: 46.4% and 52.3%, against roughly 41% and 45% for those that bottomed months ago.

## Caveats

Both universes hold only currently-active, tradable names, so every stock in them survived. That bias favours "went quiet and recovered", and the setup still does not pay. Estimate revisions were never tested: the free tiers serve a current snapshot or twelve months, and a proper test needs a vendor with multi-year as-of-date estimates.
