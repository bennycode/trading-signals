# Trading Signals

Technical indicators to run technical analysis with JavaScript / TypeScript.

## Motivation

Provide a TypeScript implementation for common technical indicators with arbitrary-precision decimal arithmetic.

## Supported Indicators

- Exponential Moving Average (EMA)
- Simple Moving Average (SMA)
- Smoothed Moving Average (SMMA)

## Usage

```typescript
import Big from 'big.js';
import {SMA} from 'trading-signals';

const sma = new SMA(3);
sma.update(new Big(40));
sma.update(new Big(30));
sma.update(new Big(20));
console.log(sma.getResult().valueOf()); // "30"
```
