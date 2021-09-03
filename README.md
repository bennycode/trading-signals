# Trading Signals

![Language Details](https://img.shields.io/github/languages/top/bennycode/trading-signals) ![Code Coverage](https://img.shields.io/codecov/c/github/bennycode/trading-signals/main) ![License](https://img.shields.io/npm/l/trading-signals.svg) ![Package Version](https://img.shields.io/npm/v/trading-signals.svg) ![Dependency Updates](https://img.shields.io/david/bennycode/trading-signals.svg)

Technical indicators and overlays to run technical analysis with JavaScript / TypeScript.

## Motivation

Provide a TypeScript implementation for common technical indicators with arbitrary-precision decimal arithmetic.

## Features

- **Accurate.** Don't rely on type `number` and its precision limits. Use [Big][1].
- **Typed.** Source code is 100% TypeScript. No need to install external typings.
- **Tested.** Code coverage is 100%. No surprises when using it.

## Supported Indicators

1. Acceleration Bands (ABANDS)
1. Accelerator Oscillator (AC)
1. Average Directional Index (ADX)
1. Average True Range (ATR)
1. Awesome Oscillator (AO)
1. Bollinger Bands (BBANDS)
1. Center of Gravity (CG)
1. Double Exponential Moving Average (DEMA)
1. Double Moving Average (DMA)
1. Exponential Moving Average (EMA)
1. Momentum (MOM)
1. Moving Average Convergence Divergence (MACD)
1. Rate-of-Change (ROC)
1. Relative Strength Index (RSI)
1. Simple Moving Average (SMA)
1. Smoothed Moving Average (SMMA)
1. Wilder's Smoothed Moving Average (WSMA)

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

## Good to know

This library draws attention to miscalculations by throwing errors instead of returning default values. If you call `getResult()`, before an indicator has received the required amount of input values, a `NotEnoughDataError` will be thrown.

**Example:**

```ts
import {SMA} from 'trading-signals';

// Our interval is 3, so we need 3 input values
const sma = new SMA(3);

// We supply 2 input values
sma.update(10);
sma.update(40);

try {
  // We will get an error, because the minimum amount of inputs is 3
  sma.getResult();
} catch (error) {
  console.log(error.constructor.name); // "NotEnoughDataError"
}

// We will supply the 3rd input value
sma.update(70);

// Now, we will receive a proper result
console.log(sma.getResult().valueOf()); // "40"
```

## Alternatives

- [Tulip Indicators (ANSI C)](https://github.com/TulipCharts/tulipindicators)
- [Pandas TA (Python)](https://github.com/twopirllc/pandas-ta)
- [Jesse Trading Bot Indicators (Python)](https://docs.jesse.trade/docs/indicators/reference.html)
- [libindicators (C#)](https://github.com/mgfx/libindicators)
- [Cloud9Trader Indicators (JavaScript)](https://github.com/Cloud9Trader/TechnicalIndicators)
- [Crypto Trading Hub Indicators (TypeScript)](https://github.com/anandanand84/technicalindicators)
- [Technical Analysis Library using Pandas and Numpy (Python)](https://github.com/bukosabino/ta)

## Maintainers

[![Benny Neugebauer on Stack Exchange][stack_exchange_bennycode_badge]][stack_exchange_bennycode_url]

## Contributing

Contributions, issues and feature requests are welcome!

Feel free to check the [issues page](https://github.com/bennycode/trading-signals/issues).

## License

This project is [MIT](./LICENSE) licensed.

## ⭐️ Show your support ⭐️

[Please leave a star](https://github.com/bennycode/trading-signals/stargazers) if you find this project useful.

If you like this project, you might also like these related projects:

- [**coinbase-pro-node**](https://github.com/bennycode/coinbase-pro-node), Actively maintained Coinbase Pro API written in TypeScript.
- [**ig-trading-api**](https://github.com/bennycode/ig-trading-api), IG CFD Trading API written in TypeScript.
- [**binance-api-node**](https://github.com/Ashlar/binance-api-node), Heavily tested and Promise-based Binance API with TypeScript definitions.

[1]: http://mikemcl.github.io/big.js/
[stack_exchange_bennycode_badge]: https://stackexchange.com/users/flair/203782.png?theme=default
[stack_exchange_bennycode_url]: https://stackexchange.com/users/203782/benny-neugebauer?tab=accounts
