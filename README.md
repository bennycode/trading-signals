# Trading Signals

![Language Details](https://img.shields.io/github/languages/top/bennyn/trading-signals) ![Code Coverage](https://img.shields.io/codecov/c/github/bennyn/trading-signals/master) ![License](https://img.shields.io/npm/l/trading-signals.svg) ![Package Version](https://img.shields.io/npm/v/trading-signals.svg) ![Dependency Updates](https://img.shields.io/david/bennyn/trading-signals.svg)

Technical indicators and overlays to run technical analysis with JavaScript / TypeScript.

## Motivation

Provide a TypeScript implementation for common technical indicators with arbitrary-precision decimal arithmetic.

## Supported Indicators

1. Average Directional Index (ADX)
1. Average True Range (ATR)
1. Bollinger Bands (BB)
1. Double Exponential Moving Average (DEMA)
1. Double Moving Average (DMA)
1. Exponential Moving Average (EMA)
1. Moving Average Convergence Divergence (MACD)
1. Rate-of-Change (ROC)
1. Relative Strength Index (RSI)
1. Simple Moving Average (SMA)
1. Smoothed Moving Average (SMMA)

## Usage

```typescript
import {SMA} from 'trading-signals';

const sma = new SMA(3);

// You can add numbers:
sma.update(40);
sma.update(30);
sma.update(20);

// You can add strings:
sma.update('10');

// You can add arbitrary-precision decimals:
import Big from 'big.js';
sma.update(new Big(30));

// You can get the result in various formats:
console.log(sma.getResult().valueOf()); // "20"
console.log(sma.getResult().toFixed(2)); // "20.00"
```

## Contributing

Contributions, issues and feature requests are welcome!

Feel free to check the [issues page](https://github.com/bennyn/trading-signals/issues).

## Maintainers

[![Benny Neugebauer on Stack Exchange][stack_exchange_bennyn_badge]][stack_exchange_bennyn_url]

## License

This project is [MIT](./LICENSE) licensed.

## Show your support

Give a ⭐️ if this project helped you!<

[stack_exchange_bennyn_badge]: https://stackexchange.com/users/flair/203782.png?theme=default
[stack_exchange_bennyn_url]: https://stackexchange.com/users/203782/benny-neugebauer?tab=accounts
