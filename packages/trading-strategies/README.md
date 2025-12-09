# Trading Strategies

Trading strategies to run trading bots with JavaScript / TypeScript.

## Motivation

The "trading-strategies" library provides a TypeScript implementation for common trading strategies. It is designed to work seamlessly with the [trading-signals](https://www.npmjs.com/package/trading-signals) library, allowing developers to combine technical indicators into complete automated trading strategies.

## Installation

```bash
npm install trading-strategies
```

## Usage

```ts
import {StrategySignal, StrategyAdvice} from 'trading-strategies';
```

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
