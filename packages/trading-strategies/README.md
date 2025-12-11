# Trading Strategies

Trading strategy implementations that combine technical indicators into actionable trading signals. Ideally designed for creating custom strategies and operating automated trading bots.

## Motivation

The "trading-strategies" library provides a TypeScript implementation for common trading strategies. It is designed to work seamlessly with the [trading-signals](https://www.npmjs.com/package/trading-signals) library, allowing developers to combine technical indicators into complete automated trading strategies.

> [!CAUTION]
>
> No strategy works all the time, so build in strict loss caps, a realistic positive price target, and the discipline to accept occasional losses. Managing risk matters more than heroically “holding a falling knife,” so focus on winning more often than you lose.

## Installation

```bash
npm install trading-strategies
```

## Usage

```ts
import {StrategySignal, StrategyAdvice} from 'trading-strategies';
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

## Strategy Signals

- `BUY_MARKET`: Buy at current market price
- `BUY_LIMIT`: Buy when price reaches specified limit
- `SELL_MARKET`: Sell at current market price
- `SELL_LIMIT`: Sell when price reaches specified limit
- `NONE`: No action recommended

## Backtesting

Always backtest your strategies with historical data before deploying them in live trading. A good strategy should:

1. **Beat Buy-and-Hold:** Outperform simply holding the asset
2. **Beat Random Chance:** Outperform the `CoinFlipStrategy` baseline
3. **Work in All Markets:** Perform well in bullish, bearish, and sideways markets
4. **Manage Risk:** Include stop-loss limits and realistic profit targets
5. **Handle Losses:** Accept that no strategy wins 100% of the time

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
