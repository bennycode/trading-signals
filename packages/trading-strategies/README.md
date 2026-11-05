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

## How a Strategy Works

A strategy watches the market one candle at a time and decides what to do next: **buy, sell, or wait.** You write that decision and the library handles the rest, turning it into a correctly sized order while keeping track of balances, fees, and each exchange's trading rules for you.

On every new candle your strategy sees the latest price data and a snapshot of your account, then returns one of:

- **Buy** at the current price (market order) or at a price you set (limit order)
- **Sell** at the current price or at a price you set
- **Nothing**, to sit this one out

In code, that decision is the return value of `processCandle`:

```ts
import {OrderSide, OrderType, type OneMinuteBatchedCandle} from '@typedtrader/exchange';
import {AllAvailableAmount, Strategy, type OrderAdvice, type TradingSessionState} from 'trading-strategies';

class BuyTheDipStrategy extends Strategy {
  static override NAME = 'buy-the-dip';

  protected override async processCandle(
    candle: OneMinuteBatchedCandle,
    state: TradingSessionState
  ): Promise<OrderAdvice | void> {
    if (state.baseBalance.eq(0) && candle.close.lt(100)) {
      return {
        amount: AllAvailableAmount,
        amountIn: 'counter',
        reason: 'price dipped below 100',
        side: OrderSide.BUY,
        type: OrderType.MARKET,
      };
    }
    // Returning nothing means "wait".
  }
}
```

A strategy never places orders itself. It only gives _advice_, and the library works out how to fill it safely.

You can also start from a ready-made base instead of from scratch. For example, **`ProtectedStrategy`** adds automatic stop-loss and take-profit guards: build your buy/sell logic on top of it and your position is protected with no extra work.

## Same Strategy, Backtest or Live

Write a strategy once and run it in two places without changing a line:

- **Backtest**: replay historical candles to measure how it would have performed.
- **Live or paper trading**: stream real candles from a broker and trade for real, or with simulated money.

Both give the strategy the same information and handle its advice the same way, so a backtest is a faithful rehearsal of live trading rather than a rough approximation. Always backtest before you go live (see [Backtesting](#backtesting)).

Running a backtest looks like this:

```ts
import {BacktestExecutor, MeanReversionStrategy} from 'trading-strategies';

const result = await new BacktestExecutor({
  candles, // historical price data
  broker, // a simulated exchange
  strategy: new MeanReversionStrategy(),
  tradingPair,
}).execute();

console.log(result.performance.returnPercentage);
```

## What a Strategy Can Use

Most strategies combine **technical indicators** from the companion [trading-signals](https://www.npmjs.com/package/trading-signals) library, such as moving averages, RSI or Bollinger Bands. That's the common case, but not a rule: a strategy is ordinary code, so before it decides it can also draw on anything else: your own database, the latest news or earnings, or analyst ratings from an outside service.

## Reports

In addition to strategies, the library includes reports that analyze market data and return formatted results. Reports implement the `Report` base class and can be run on-demand or scheduled at recurring intervals.

Available reports include:

- **`SP500MomentumReport`** — ranks the S&P 500 by 12-1 cross-sectional momentum (Jegadeesh & Titman, 1993).
- **`SP500HeatmapReport`** — a snapshot of S&P 500 performance.
- **`ScalpScannerReport`** — scans for short-term scalping opportunities.

Adding a **fingerprint (a short hash of the raw result data)** to a report is good practice: when two runs share the same fingerprint nothing changed.

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

Exchanges, brokers, order types, market makers vs. takers, trading filters, trader profiles: all explained in the [Trading Glossary](https://bennycode.com/trading-signals/basics/glossary).

## Strategies

### BuyOnce

Buys once and then stays silent. Supports two modes depending on whether `buyAt` is set:

| Config        | Behavior                                           | Order type |
| ------------- | -------------------------------------------------- | ---------- |
| No `buyAt`    | Buys immediately on the first candle               | Market     |
| `buyAt: "95"` | Waits for the close price to drop to 95, then buys | Limit      |

**Sizing** is controlled with `quantity` or `spend` (mutually exclusive, enforced at the type level):

| Config           | Meaning                                     |
| ---------------- | ------------------------------------------- |
| _(neither)_      | Spend all available counter balance         |
| `quantity: "10"` | Buy exactly 10 units of the base asset      |
| `spend: "500"`   | Spend exactly 500 units of counter currency |

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

A strategy expresses intent by returning an `OrderAdvice` from `processCandle` (see [How a Strategy Works](#how-a-strategy-works)), or `void`/`undefined` for "no action". A market order fills at the current price, a limit order only at the price you name:

```ts
// Market buy, sized in the counter currency (e.g. spend USD) or in the base currency
{type: 'MARKET', side: 'BUY', amountIn: 'counter', amount: AllAvailableAmount}
{type: 'MARKET', side: 'BUY', amountIn: 'base', amount: '0.5'}

// Market sell, sized in either currency
{type: 'MARKET', side: 'SELL', amountIn: 'base', amount: AllAvailableAmount}

// Limit order, always sized in the base currency and always with a price
{type: 'LIMIT', side: 'BUY', amountIn: 'base', amount: '0.5', price: '95'}
{type: 'LIMIT', side: 'SELL', amountIn: 'base', amount: AllAvailableAmount, price: '105'}
```

Every shape takes an optional `reason` string for logs and diagnostics. `AllAvailableAmount` trades the full available balance, with one exception: a market buy sized in the base currency needs an explicit amount, because without a price the quantity cannot be derived.

## Market Regimes

No strategy works in every market. Classifying the current market state — the **regime** — helps decide which strategy is actually applicable right now. A useful model crosses **direction** (is price going up, down, or nowhere?) with **volatility** (how much is it moving?):

|                  | Low volatility                                | High volatility                                   |
| ---------------- | --------------------------------------------- | ------------------------------------------------- |
| **Uptrending**   | **Smooth uptrend** — trend-following longs    | **Volatile uptrend** — breakout longs, wide stops |
| **Downtrending** | **Smooth downtrend** — trend-following shorts | **Volatile downtrend** — breakout shorts          |
| **Ranging**      | **Tight range** — wait / accumulate           | **Wide range** — mean reversion, scalping         |

Splitting direction into _up_ / _down_ / _ranging_ (instead of a single _directional_ axis) matters because long-only strategies only apply to uptrends, short strategies only to downtrends, and mean reversion works very differently in a sideways range than inside a trend.

In practice this maps cleanly onto measurements that are cheap to compute from daily candles:

- **Direction strength:** the [Efficiency Ratio](https://www.investopedia.com/articles/trading/07/kama.asp) (ER) — close to `1` means a clean directional move, close to `0` means pure noise. Pair it with the sign of the long-window slope (or a moving-average crossover) to decide _up_ vs. _down_.
- **Volatility:** average daily range relative to price (ATR%).

A seventh bucket worth naming is **noise** — price movement with neither direction nor meaningful range. No strategy has an edge there; the right move is to stay out.

Two distinct things use this concept:

1. **Strategies** declare which regime(s) they target as static metadata, so you can answer _"given today's market for AAPL, which of my strategies are applicable?"_.
2. **Stocks** get a _dynamic_ regime label computed from recent price action, so the same stock can be classified differently across time windows.

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

[stack_exchange_bennycode_badge]: https://stackexchange.com/users/flair/203782.png?theme=default
[stack_exchange_bennycode_url]: https://stackexchange.com/users/203782/benny-neugebauer?tab=accounts

## License

This project is [MIT](./LICENSE) licensed.
