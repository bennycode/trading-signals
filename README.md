# Trading Signals

![Language Details](https://img.shields.io/github/languages/top/bennycode/trading-signals) ![Code Coverage](https://img.shields.io/codecov/c/github/bennycode/trading-signals/main) ![License](https://img.shields.io/npm/l/trading-signals.svg) ![Package Version](https://img.shields.io/npm/v/trading-signals.svg)

Technical indicators and overlays to run technical analysis with JavaScript / TypeScript.

## Motivation

The "trading-signals" library provides a TypeScript implementation for common technical indicators with arbitrary-precision decimal arithmetic.

The main focus of this library is on the accuracy of calculations, but using the provided [faster implementations][2] you can also use it where performance is important.

All indicators can be updated over time by streaming data (prices or [candles](https://en.wikipedia.org/wiki/Candlestick_chart)) to the `add` method. Some indicators also provide `static` batch methods for further performance improvements when providing data up-front during a backtest or historical data import. You can try it out streaming input data by running the provided [demo script](./src/start/demo.ts) with `npm start`, which uses a keyboard input stream.

## Installation

```bash
npm install trading-signals
```

## Usage

**CommonJS:**

```ts
const {Big, SMA} = require('trading-signals');
```

**ESM:**

```ts
import {Big, SMA} from 'trading-signals';
```

**Example:**

```typescript
import {Big, SMA} from 'trading-signals';

const sma = new SMA(3);

// You can add values individually:
sma.add(40);
sma.add(30);
sma.add(20);

// You can add multiple values at once:
sma.updates([20, 40, 80]);

// You can add stringified values:
sma.add('10');

// You can replace a previous value (useful for live charting):
sma.replace('40');

// You can add arbitrary-precision decimals:
sma.add(new Big(30.0009));

// You can check if an indicator is stable:
console.log(sma.isStable); // true

// If an indicator is stable, you can get its result:
console.log(sma.getResult()?.toFixed()); // "50.0003"

// You can also get the result without optional chaining:
console.log(sma.getResultOrThrow().toFixed()); // "50.0003"

// Various precisions are available too:
console.log(sma.getResultOrThrow().toFixed(2)); // "50.00"
console.log(sma.getResultOrThrow().toFixed(4)); // "50.0003"

// Each indicator also includes convenient features such as "lowest" and "highest" lifetime values:
console.log(sma.lowest?.toFixed(2)); // "23.33"
console.log(sma.highest?.toFixed(2)); // "53.33"
```

### When to use `add(...)`?

To input data, you need to call the indicator's `add` method. Depending on whether the minimum required input data for the interval has been reached, the `add` method may or may not return a result from the indicator.

### When to use `getResultOrThrow()`?

You can call `getResultOrThrow()` at any point in time, but it throws errors unless an indicator has received the minimum amount of data. If you call `getResultOrThrow()`, before an indicator has received the required amount of input values, a `NotEnoughDataError` will be thrown.

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
  sma.getResultOrThrow();
} catch (error) {
  console.log(error.constructor.name); // "NotEnoughDataError"
}

// We will supply the 3rd input value
sma.update(70);

// Now, we will receive a proper result
console.log(sma.getResultOrThrow().valueOf()); // "40"
```

Most of the time, the minimum amount of data depends on the interval / time period used.

## Technical Indicator Types

- Trend indicators: Measure the direction of a trend (uptrend, downtrend or sideways trend)
- Volume indicators: Measure the strength of a trend (based on volume)
- Volatility indicators: Measure how much disagreement there is in the market based on price (statistical measure of its dispersion)
- Momentum indicators: Measure the strength of a trend (based on price / speed of price movement)

## Supported Technical Indicators

1. [Acceleration Bands](./src/ABANDS/AccelerationBands.ts) (ABANDS)
1. [Accelerator Oscillator](./src/AC/AC.ts) (AC)
1. [Average Directional Index](./src/ADX/ADX.ts) (ADX)
1. [Average True Range](./src/ATR/ATR.ts) (ATR)
1. [Awesome Oscillator](./src/AO/AO.ts) (AO)
1. [Bollinger Bands](./src/BBANDS/BollingerBands.ts) (BBANDS)
1. [Bollinger Bands Width](./src/BBW/BollingerBandsWidth.ts) (BBW)
1. [Center of Gravity](./src/CG/CG.ts) (CG)
1. [Commodity Channel Index](./src/CCI/CCI.ts) (CCI)
1. [Directional Movement Index](./src/DX/DX.ts) (DMI / DX)
1. [Double Exponential Moving Average](./src/DEMA/DEMA.ts) (DEMA)
1. [Dual Moving Average](./src/DMA/DMA.ts) (DMA)
1. [Exponential Moving Average](./src/EMA/EMA.ts) (EMA)
1. [Interquartile Range](./src/IQR/IQR.ts) (IQR)
1. [Linear Regression](./src/LINREG/LinearRegression.ts) (LINREG)
1. [Mean Absolute Deviation](./src/MAD/MAD.ts) (MAD)
1. [Momentum](./src/MOM/MOM.ts) (MOM / MTM)
1. [Moving Average Convergence Divergence](./src/MACD/MACD.ts) (MACD)
1. [On-Balance Volume](./src/OBV/OBV.ts) (OBV)
1. [Parabolic SAR](./src/PSAR/PSAR.ts) (PSAR)
1. [Rate-of-Change](./src/ROC/ROC.ts) (ROC)
1. [Relative Moving Average](./src/RMA/RMA.ts) (RMA)
1. [Relative Strength Index](./src/RSI/RSI.ts) (RSI)
1. [Simple Moving Average](./src/SMA/SMA.ts) (SMA)
1. [Stochastic Oscillator](./src/STOCH/StochasticOscillator.ts) (STOCH)
1. [Stochastic RSI](./src/STOCH/StochasticRSI.ts) (STOCHRSI)
1. [Tom Demark's Sequential Indicator](./src/TDS/TDS.ts) (TDS)
1. [True Range](./src/TR/TR.ts) (TR)
1. [Volume-Weighted Average Price](./src/VWAP/VWAP.ts) (VWAP)
1. [Weighted Moving Average](./src/WMA/WMA.ts) (WMA)
1. [Wilder's Smoothed Moving Average](./src/WSMA/WSMA.ts) (WSMA / WWS / SMMA / MEMA)

Utility Methods:

1. [Average / Mean](./src/util/getAverage.ts)
1. [Median](./src/util/getMedian.ts)
1. [Quartile](./src/util/getQuartile.ts)
1. [Standard Deviation](./src/util/getStandardDeviation.ts)
1. [Streaks](./src/util/getStreaks.ts)

## Performance

### Arbitrary-precision decimal arithmetic

JavaScript is very bad with numbers. When calculating `0.1 + 0.2` it shows you `0.30000000000000004`, but the truth is `0.3`.

![JavaScript arithmetic](https://raw.githubusercontent.com/bennycode/trading-signals/HEAD/js-arithmetic.png)

As specified by the ECMAScript standard, all arithmetic in JavaScript uses [double-precision floating-point arithmetic](https://en.wikipedia.org/wiki/Double-precision_floating-point_format), which is only accurate until certain extent. To increase the accuracy and avoid miscalculations, the [trading-signals](https://github.com/bennycode/trading-signals) library uses [big.js][1] which offers arbitrary-precision decimal arithmetic. However, this arbitrary accuracy comes with a downside: Calculations with it are not as performant as with the primitive data type `number`.

### Faster implementations

To get the best of both worlds (high accuracy & high performance), you will find two implementations of each indicator (e.g. `SMA` & `FasterSMA`). The standard implementation uses [big.js][1] and the `Faster`-prefixed version uses common `number` types. Use the standard one when you need high accuracy and use the `Faster`-one when you need high performance:

```ts
import {FasterSMA} from './SMA/SMA';

const fasterSMA = new FasterSMA(5);
console.log(fasterSMA.updates([1, 2, 3, 4, 5]));
```

```ts
import {FasterStochasticRSI, FasterSMA} from 'trading-signals';

const fasterStochRSI = new FasterStochasticRSI(3, FasterSMA);
fasterStochRSI.update(1);
fasterStochRSI.update(2);
fasterStochRSI.update(3);
fasterStochRSI.update(4);
fasterStochRSI.update(5);
fasterStochRSI.update(6);

console.log(fasterStochRSI.getResultOrThrow());
```

### Benchmarks

You can run `npm run start:benchmark` to see the runtime performance of each technical indicator on your machine. This will give you an understanding of which indicators can be calculated faster than others.

## Disclaimer

The information and publications of [trading-signals](https://github.com/bennycode/trading-signals) do not constitute financial advice, investment advice, trading advice or any other form of advice. All results from [trading-signals](https://github.com/bennycode/trading-signals) are intended for information purposes only.

It is very important to do your own analysis before making any investment based on your own personal circumstances. If you need financial advice or further advice in general, it is recommended that you identify a relevantly qualified individual in your jurisdiction who can advise you accordingly.

## Alternatives

- [Cloud9Trader Indicators (JavaScript)](https://github.com/Cloud9Trader/TechnicalIndicators)
- [Crypto Trading Hub Indicators (TypeScript)](https://github.com/anandanand84/technicalindicators)
- [Indicator TS](https://github.com/cinar/indicatorts)
- [Jesse Trading Bot Indicators (Python)](https://docs.jesse.trade/docs/indicators/reference.html)
- [LEAN Indicators](https://github.com/QuantConnect/Lean/tree/master/Indicators)
- [libindicators (C#)](https://github.com/mgfx/libindicators)
- [Pandas TA (Python)](https://github.com/twopirllc/pandas-ta)
- [ta4j (Java)](https://github.com/ta4j/ta4j)
- [Technical Analysis for Rust (Rust)](https://github.com/greyblake/ta-rs)
- [Technical Analysis Library using Pandas and Numpy (Python)](https://github.com/bukosabino/ta)
- [Tulip Indicators (ANSI C)](https://github.com/TulipCharts/tulipindicators)

## Maintainers

[![Benny Neugebauer on Stack Exchange][stack_exchange_bennycode_badge]][stack_exchange_bennycode_url]

## ⭐️ Become a TypeScript rockstar! ⭐️

This package was built by Benny Code. Checkout my [**TypeScript course**](https://typescript.tv/) to become a coding rockstar!

[<img src="https://raw.githubusercontent.com/bennycode/trading-signals/main/tstv.png">](https://typescript.tv/)

[1]: http://mikemcl.github.io/big.js/
[2]: #faster-implementations
[stack_exchange_bennycode_badge]: https://stackexchange.com/users/flair/203782.png?theme=default
[stack_exchange_bennycode_url]: https://stackexchange.com/users/203782/benny-neugebauer?tab=accounts

## License

This project is [MIT](./LICENSE) licensed.
