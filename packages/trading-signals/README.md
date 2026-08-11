# Trading Signals

![Language Details](https://img.shields.io/github/languages/top/bennycode/trading-signals) ![Code Coverage](https://img.shields.io/codecov/c/github/bennycode/trading-signals/main) ![License](https://img.shields.io/npm/l/trading-signals.svg) ![Package Version](https://img.shields.io/npm/v/trading-signals.svg)

Technical indicators and overlays to run [technical analysis](https://en.wikipedia.org/wiki/Technical_analysis) with JavaScript / TypeScript.

## Motivation

The "trading-signals" library provides a TypeScript implementation for common technical indicators. It is well-suited for algorithmic trading, allowing developers to perform signal computations for automated trading strategies.

Financial trading does not require Python or C, so the goal here is to provide renowned technical indicators in TypeScript. Results are checked against reference data like [Tulip Indicators](https://tulipindicators.org/).

All indicators can be updated over time by streaming data (prices or [candles](https://en.wikipedia.org/wiki/Candlestick_chart)) to the `add` method. Some indicators also provide `static` batch methods for further performance improvements when providing data up-front during a backtest or historical data import. You can try it out streaming input data by running the provided [demo script](./src/start/demo.ts) with `npm start`, which uses a keyboard input stream.

## Features

- **Streaming Updates:** No need to reprocess historical data
- **Replace Mode:** Efficient live chart updates
- **Lazy Evaluation:** Indicators only calculate when stable
- **Memory Efficiency:** Rolling windows, not full history storage
- **Excellent Test Coverage:** 100% across all metrics
- **Zero Runtime Dependencies:** Minimal bundle size
- **Type Safety:** Full TypeScript with strict mode

## Supported Technical Indicators

1. Absolute Price Oscillator (APO)
1. Acceleration Bands (ABANDS)
1. Accelerator Oscillator (AC)
1. Accumulation/Distribution (AD)
1. Accumulative Swing Index (ASI)
1. Arnaud Legoux Moving Average (ALMA)
1. Aroon (AROON)
1. Average Directional Index (ADX)
1. Average True Range (ATR)
1. Awesome Oscillator (AO)
1. Balance of Power (BOP)
1. Bollinger Bands (BBANDS)
1. Bollinger Bands %B (PB)
1. Bollinger Bands Width (BBW)
1. Center of Gravity (CG)
1. Chaikin Money Flow (CMF)
1. Chaikin Oscillator (ADOSC)
1. Chaikin Volatility (CVI)
1. Chande Forecast Oscillator (CFO)
1. Chande Kroll Stop (CKS)
1. Chande Momentum Oscillator (CMO)
1. Chandelier Exit (CE)
1. Choppiness Index (CHOP)
1. Commodity Channel Index (CCI)
1. Coppock Curve (COPPOCK)
1. DeMarker (DEM)
1. Derivative Oscillator (DOSC)
1. Detrended Price Oscillator (DPO)
1. Directional Movement Index (DMI / DX)
1. Disparity Index (DI)
1. Donchian Channels (DC)
1. Double Exponential Moving Average (DEMA)
1. Dual Moving Average (DMA)
1. Ease of Movement (EMV)
1. Elder Ray Index (ERI)
1. Exponential Moving Average (EMA)
1. Efficiency Ratio (ER)
1. Fisher Transform (FISHER)
1. Force Index (FI)
1. Fractal Adaptive Moving Average (FRAMA)
1. Gopalakrishnan Range Index (GAPO)
1. Hull Moving Average (HMA)
1. Ichimoku Cloud (ICHIMOKU)
1. Internal Bar Strength (IBS)
1. Interquartile Range (IQR)
1. Kaufman's Adaptive Moving Average (KAMA)
1. Keltner Channels (KC)
1. Klinger Volume Oscillator (KVO)
1. Know Sure Thing (KST)
1. Linear Regression (LINREG)
1. Mass Index (MI)
1. McGinley Dynamic (MD)
1. Mean Absolute Deviation (MAD)
1. MESA Adaptive Moving Average (MAMA)
1. Momentum (MOM / MTM)
1. Money Flow Index (MFI)
1. Moving Average Convergence Divergence (MACD)
1. Negative Volume Index (NVI)
1. Normalized Average True Range (NATR)
1. On-Balance Volume (OBV)
1. Parabolic SAR (PSAR)
1. Percentage Price Oscillator (PPO)
1. Percentage Volume Oscillator (PVO)
1. Positive Volume Index (PVI)
1. Premier Stochastic Oscillator (PSO)
1. Pretty Good Oscillator (PGO)
1. Price Momentum Oscillator (PMO)
1. Price Volume Trend (PVT)
1. Projection Oscillator (PO)
1. Qstick (QSTICK)
1. Range Expansion Index (REI)
1. Rate-of-Change (ROC)
1. Relative Moving Average (RMA)
1. Relative Strength Index (RSI)
1. Relative Vigor Index (RVGI)
1. Relative Volume (RVOL)
1. Rogers-Satchell Volatility (RSV)
1. Schaff Trend Cycle (STC)
1. Simple Moving Average (SMA)
1. Spencer's 15-Point Moving Average (SMA15)
1. Stochastic Oscillator (STOCH)
1. Stochastic RSI (STOCHRSI)
1. SuperSmoother Filter (SUPERSMOOTHER)
1. SuperTrend (SUPERTREND)
1. Swing Index (SI)
1. Tillson T3 Moving Average (T3)
1. Tom Demark's Sequential Indicator (TDS)
1. Triangular Moving Average (TRIMA)
1. Triple Exponential Moving Average (TEMA)
1. Triple Smoothed EMA Rate of Change (TRIX)
1. True Range (TR)
1. True Strength Index (TSI)
1. TTM Squeeze (SQUEEZE)
1. Ulcer Index (UI)
1. Ultimate Oscillator (ULTOSC)
1. Variable Index Dynamic Average (VIDYA)
1. Volatility Stop (VSTOP)
1. Volume Rate of Change (VROC)
1. Volume-Weighted Average Price (VWAP)
1. Volume Weighted Moving Average (VWMA)
1. Vortex Indicator (VI)
1. Waddah Attar Explosion (WAE)
1. WaveTrend (WT)
1. Weighted Moving Average (WMA)
1. Wilder's Smoothed Moving Average (WSMA / WWS / SMMA / MEMA)
1. Williams %R (WILLR)
1. Zero-Lag Exponential Moving Average (ZLEMA)
1. Zig Zag Indicator (ZigZag)

Utility Methods:

1. Average / Mean
1. Grid Sizing (for [grid trading bots](https://b2broker.com/news/understanding-grid-trading-purpose-pros-cons/))
1. Maximum
1. Median
1. Minimum
1. Quartile
1. Standard Deviation
1. Streaks
1. Weekday

## Installation

```bash
npm install trading-signals
```

## Usage

The library is published as ESM:

```ts
import {SMA} from 'trading-signals';
```

CommonJS projects can load it via [`require(esm)`](https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require) on Node.js 20.19+:

```ts
const {SMA} = require('trading-signals');
```

**Example:**

```typescript
import {SMA} from 'trading-signals';

const sma = new SMA(3);

// You can add values individually:
sma.add(40);
sma.add(30);
sma.add(20);

// You can add multiple values at once:
sma.updates([20, 40, 80]);

// You can replace a previous value (useful for live charting):
sma.replace(40);

// You can check if an indicator is stable:
console.log(sma.isStable); // true

// You can read the result as "number | null", which is null until the indicator is stable:
console.log(sma.getResult()); // 50.0003

// Or you can read it as "number" and let it throw while the indicator is not stable yet:
console.log(sma.getResultOrThrow()); // 50.0003

// Various precisions are available too:
console.log(sma.getResultOrThrow().toFixed(2)); // "50.00"
console.log(sma.getResultOrThrow().toFixed(4)); // "50.0003"

// Each indicator also includes convenient features such as "lowest" and "highest" lifetime values:
console.log(sma.lowest?.toFixed(2)); // "23.33"
console.log(sma.highest?.toFixed(2)); // "53.33"
```

## Technical Indicator Types

### Indicator Function

- Momentum indicators: Measure the speed and strength (intensity) of price movements in a particular direction (overbought/oversold)
- Trend indicators: Measure the direction of a trend (bullish/bearish)
- Volatility indicators: Measure the degree of variation in prices over time, regardless of direction
- Volume indicators: Measure the strength of a trend based on volume

**Key readings:**

- Bullish sentiment: expect prices to rise
- Bearish sentiment: expect prices to fall
- Overbought condition: price may have risen too much too fast, meaning it’s trending up, but traders expect a short-term dip before continuing higher
- Oversold condition: price may have dropped too much too fast, meaning it’s trending down, but traders expect a short-term bounce before continuing lower or reversing upward

### Indicator Timing

- Leading Indicators: Predictive tools that try to signal future price movements before they happen (i.e. RSI, Stochastic Oscillator, Volume spikes)
- Lagging Indicators: Confirmative tools that signal after a trend or move has already started (i.e. Moving Averages, MACD, ADX)

### Indicator Scale

- Indicators: Have no upper or lower limits
- Oscillators: Move within a fixed range (e.g. 0-100, –1 to +1)

## Alternatives

- [LEAN Indicators (C#)](https://github.com/QuantConnect/Lean/tree/master/Indicators)
- [libindicators (C#)](https://github.com/mgfx/libindicators)
- [Pandas TA (Python)](https://github.com/twopirllc/pandas-ta)
- [Stock Indicators for .NET (C#)](https://github.com/DaveSkender/Stock.Indicators)
- [StockSharp (C#)](https://github.com/StockSharp/StockSharp)
- [ta-lib (C)](https://github.com/TA-Lib/ta-lib/tree/main/src/ta_func)
- [ta-math (TypeScript)](https://github.com/munrocket/ta-math)
- [ta4j (Java)](https://github.com/ta4j/ta4j)
- [Technical Analysis for Rust (Rust)](https://github.com/greyblake/ta-rs)
- [Technical Analysis Library using Pandas and Numpy (Python)](https://github.com/bukosabino/ta)
- [Tulip Indicators (ANSI C)](https://github.com/TulipCharts/tulipindicators)

## Maintainers

[![Benny Neugebauer on Stack Exchange][stack_exchange_bennycode_badge]][stack_exchange_bennycode_url]

[stack_exchange_bennycode_badge]: https://stackexchange.com/users/flair/203782.png?theme=default
[stack_exchange_bennycode_url]: https://stackexchange.com/users/203782/benny-neugebauer?tab=accounts

## License

This project is [MIT](./LICENSE) licensed.
