# Trading Strategies

Trading strategy implementations that combine technical indicators into actionable trading signals. Ideally designed for creating custom strategies and operating automated trading bots.

## Motivation

The "trading-strategies" library provides a TypeScript implementation for common trading strategies. It is designed to work seamlessly with the [trading-signals](https://www.npmjs.com/package/trading-signals) library, allowing developers to combine technical indicators into complete automated trading strategies.

> [!CAUTION]
>
> No strategy works all the time, so build in strict loss caps, a realistic positive price target, and the discipline to accept occasional losses. Managing risk matters more than heroically “holding a falling knife,” so focus on winning more often than you lose.

**A good strategy should have:**

- A clearly defined scenario for when it applies (a choppy, range-bound stock requires a different approach than a trending one)
- A stop-loss rule to cap downside risk
- A profit target to lock in gains

## Installation

```bash
npm install trading-strategies
```

## Usage

```ts
import {Strategy} from 'trading-strategies';
import {ExchangeOrderSide, ExchangeOrderType} from '@typedtrader/exchange';
import type {OrderAdvice} from '@typedtrader/exchange';
```

## Reports

In addition to strategies, the library includes reports that analyze market data and return formatted results. Reports implement the `Report` base class and can be run on-demand or scheduled at recurring intervals.

## Zod Schemas

Every strategy exports a Zod schema for configuration validation and type inference:

```ts
import {MultiIndicatorConfluenceSchema, type MultiIndicatorConfluenceConfig} from 'trading-strategies';

// Validate user input at runtime
const result = MultiIndicatorConfluenceSchema.safeParse(userInput);

// Type is inferred automatically from the schema
type Config = MultiIndicatorConfluenceConfig; // z.infer<typeof MultiIndicatorConfluenceSchema>
```

## Domain Knowledge

- An **exchange** (such as the [NYSE](https://en.wikipedia.org/wiki/New_York_Stock_Exchange)) is a marketplace where buyers and sellers trade assets, it matches orders by price and time, and it operates only during **specific opening hours**.

- A **broker** (such as [Alpaca](https://alpaca.markets/) or [Interactive Brokers](https://www.interactivebrokers.com/)) is a service that gives traders access to the exchange and executes trades, acting as the middle layer between the trader and the market.

- **Backtesting** is the process of evaluating a trading strategy by running it on historical market data to see how it would have performed.

- **Paper trading** is the process of evaluating a trading strategy in real time using simulated money to mimic live trading without financial risk.

- An **order book** is a real-time list of all the buy and sell orders for an asset, organized by price, showing where traders are willing to **buy (bids)** and **sell (asks)** and how much liquidity (trading volume) is available at each level.

- The **spread** is the difference between the **bid price** buyers offer and the **ask price** sellers accept. A wide spread often signals low liquidity or higher uncertainty in the market, while a tighter spread suggests the opposite.

- A **long position** is when a trader buys an asset because they expect its price to rise, and they plan to sell it later for a profit.

- A **short position** is when a trader sells an asset they do not own by borrowing it because they expect its price to fall, and they plan to buy it back later at a lower price.

- A **market order** tells the broker to buy or sell immediately at the best available current price.

- A **limit order** tells the broker to buy or sell only at a specific price, so it won’t execute unless the market reaches that price.

- A **market maker** adds liquidity by placing orders that sit on the order book and wait for someone to trade against them. This usually affects broker fees because brokers often reward makers with lower trading fees when placing their orders. **Limit orders** are usually market maker orders when they rest on the order book and wait to be filled.

- A **market taker** removes liquidity by placing orders that execute immediately against those resting orders on the order book. This usually leads to higher trading fees because brokers often charge more for taking liquidity from the order book. **Market orders** are usually market taker orders because they execute immediately against orders already on the book.

- **Spot trading** is when a trader buys or sells an asset with immediate settlement, meaning ownership of the asset is transferred right away.

- **Futures trading** is when a trader buys or sells a contract that represents an agreement to trade an asset at a later date.

- **Fungible assets** are assets where each unit is interchangeable with another unit of the same type, meaning they have identical value and properties and can be exchanged one for one without loss. Stocks are fungible assets because one share of a company’s common stock is interchangeable with any other share of the same class, carrying the same rights, value, and economic exposure regardless of who owns it.

- **Non-fungible assets** are assets where each unit is unique and not directly interchangeable with another, meaning their value depends on specific characteristics such as rarity, condition, history, or ownership rather than a standard market price. A Pokémon trading card is a non-fungible asset because each card can differ in edition, rarity, condition, and even print run, so one card is not perfectly interchangeable with another, even if they feature the same Pokémon.

- **Trading filters** constrain exchange orders to valid values. The **tick size** is the smallest allowed price increment: with a tick size of `0.01`, a price of `2500.01` is valid but `2500.015` is not. The **step size** (or lot size) works the same way for quantities: with a step size of `0.0001`, a quantity of `0.0002` is valid but `0.00025` is not. Exchanges also set a **minimum notional value**, which is the minimum total order value (price × quantity). If the minimum notional is `5 USDT`, buying `0.001 BTC` at `2500 USDT` would be rejected because `0.001 × 2500 = 2.5 USDT` falls below the limit. Traders need to query the exchange's trading rules (e.g., [Binance's Spot Trading Rules](https://www.binance.com/en/academy/articles/binance-spot-trading-rules-a-comprehensive-guide)) and round their values before submitting orders.

- **Asset identifiers** differ by market and licensing. A **ticker symbol** (e.g., `AAPL` for [Apple Inc.](https://en.wikipedia.org/wiki/Apple_Inc.)) is an exchange-specific code and not globally unique. An **ISIN** (`US0378331005`) is a 12-character global identifier under ISO 6166, while a **CUSIP** (`037833100`) is a 9-character code used mainly in the U.S. and Canada. Both ISIN and CUSIP databases are maintained by commercial organizations and require paid licenses for redistribution, which is why many open-source projects and free APIs rely on ticker symbols instead ([source](https://forum.alpaca.markets/t/is-there-a-list-for-all-etfs/9117/4)).

- A **day trader** opens and closes every position within the same trading session and holds nothing overnight, which avoids gap risk and overnight margin costs but demands constant attention. Profits come from many small intraday moves, so the typical reference candles are 1-minute to 15-minute, and stops are tight because the horizon (minutes to hours) leaves no room for adverse moves to recover.

- A **swing trader** holds positions for several days to a few weeks to capture a single directional "swing" within a broader trend. The horizon is long enough to ride out intraday noise but short enough that long-term fundamentals are secondary to chart patterns and momentum. Daily and 4-hour candles are the typical reference timeframes, and stops are wider than a day trader's to absorb overnight volatility.

- A **position trader** holds for months to years and treats short-term price action as noise around a longer thesis driven by fundamentals (earnings, macro shifts, structural changes). Technical analysis serves mainly to time entries; once in, drawdowns of 20% or more are tolerated as part of normal holding behavior. Weekly and monthly candles are the relevant timeframes, and trade frequency is low enough that transaction costs barely matter.

## Strategies

### BuyOnce

Buys once and then stays silent. Supports two modes depending on whether `buyAt` is set:

| Config | Behavior | Order type |
| --- | --- | --- |
| No `buyAt` | Buys immediately on the first candle | Market |
| `buyAt: "95"` | Waits for the close price to drop to 95, then buys | Limit |

**Sizing** is controlled with `quantity` or `spend` (mutually exclusive, enforced at the type level):

| Config | Meaning |
| --- | --- |
| _(neither)_ | Spend all available counter balance |
| `quantity: "10"` | Buy exactly 10 units of the base asset |
| `spend: "500"` | Spend exactly 500 units of counter currency |

All strategies extend `ProtectedStrategy`, so stop-loss and take-profit guards can be added via the `protected` key:

```json
{
  "buyAt": "95",
  "spend": "500",
  "protected": {
    "stopLossPct": "5",
    "takeProfitPct": "10"
  }
}
```

### ProtectionOnly

Never opens a position. Use with `seedFromBalance: true` to attach guards to an existing position:

```json
{
  "protected": {
    "stopLossPct": "5",
    "takeProfitPct": "10",
    "seedFromBalance": true
  }
}
```

The strategy seeds its position tracking from the account's base balance and the first candle's close price. Guards fire relative to that baseline.

## Strategy Signals

- `BUY_MARKET`: Buy at current market price
- `BUY_LIMIT`: Buy when price reaches specified limit
- `SELL_MARKET`: Sell at current market price
- `SELL_LIMIT`: Sell when price reaches specified limit
- `NONE`: No action recommended

## Market Regimes

No strategy works in every market. Classifying the current market state — the **regime** — helps decide which strategy is actually applicable right now. A useful model crosses **direction** (is price going up, down, or nowhere?) with **volatility** (how much is it moving?):

|                  | Low volatility                                   | High volatility                                 |
| ---------------- | ------------------------------------------------ | ----------------------------------------------- |
| **Uptrending**   | **Smooth uptrend** — trend-following longs       | **Volatile uptrend** — breakout longs, wide stops |
| **Downtrending** | **Smooth downtrend** — trend-following shorts    | **Volatile downtrend** — breakout shorts        |
| **Ranging**      | **Tight range** — wait / accumulate              | **Wide range** — mean reversion, scalping       |

Splitting direction into *up* / *down* / *ranging* (instead of a single *directional* axis) matters because long-only strategies only apply to uptrends, short strategies only to downtrends, and mean reversion works very differently in a sideways range than inside a trend.

In practice this maps cleanly onto measurements that are cheap to compute from daily candles:

- **Direction strength:** the [Efficiency Ratio](https://www.investopedia.com/articles/trading/07/kama.asp) (ER) — close to `1` means a clean directional move, close to `0` means pure noise. Pair it with the sign of the long-window slope (or a moving-average crossover) to decide *up* vs. *down*.
- **Volatility:** average daily range relative to price (ATR%).

A seventh bucket worth naming is **noise** — price movement with neither direction nor meaningful range. No strategy has an edge there; the right move is to stay out.

Two distinct things use this concept:

1. **Strategies** declare which regime(s) they target as static metadata, so you can answer *"given today's market for AAPL, which of my strategies are applicable?"*.
2. **Stocks** get a *dynamic* regime label computed from recent price action, so the same stock can be classified differently across time windows.

## Backtesting

Always backtest your strategies with historical data before deploying them in live trading. A good strategy should:

1. **Beat Buy-and-Hold:** Outperform simply holding the asset
2. **Beat Random Chance:** Outperform the `CoinFlipStrategy` baseline
3. **Beat Broad Benchmarks:** Outperform the MSCI World or S&P 500 (after costs)
4. **Work in All Markets:** Perform well in bullish, bearish, and sideways markets
5. **Avoid Overfitting:** Perform well on historic data and real-world data
6. **Manage Risk:** Include stop-loss limits and realistic profit targets
7. **Handle Losses:** Accept that no strategy wins 100% of the time

## Disclaimer

The information and publications of [trading-strategies](https://github.com/bennycode/trading-signals) do not constitute financial advice, investment advice, trading advice or any other form of advice. All results from [trading-strategies](https://github.com/bennycode/trading-signals) are intended for information purposes only.

It is very important to do your own analysis before making any investment based on your own personal circumstances. If you need financial advice or further advice in general, it is recommended that you identify a relevantly qualified individual in your jurisdiction who can advise you accordingly.

## Maintainers

[![Benny Neugebauer on Stack Exchange][stack_exchange_bennycode_badge]][stack_exchange_bennycode_url]

## ⭐️ Become a TypeScript rockstar! ⭐️

This package was built by Benny Neugebauer. Checkout my [**TypeScript course**](https://typescript.tv/) to become a coding rockstar!

[<img src="https://raw.githubusercontent.com/bennycode/trading-signals/main/packages/trading-signals/tstv.png">](https://typescript.tv/)

[stack_exchange_bennycode_badge]: https://stackexchange.com/users/flair/203782.png?theme=default
[stack_exchange_bennycode_url]: https://stackexchange.com/users/203782/benny-neugebauer?tab=accounts

## License

This project is [MIT](./LICENSE) licensed.
