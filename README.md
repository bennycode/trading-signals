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
