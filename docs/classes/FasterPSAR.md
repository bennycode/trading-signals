[trading-signals](../README.md) / [Exports](../modules.md) / FasterPSAR

# Class: FasterPSAR

Faster Parabolic SAR (PSAR) Type: Trend

A high-performance implementation of the Parabolic Stop and Reverse (PSAR) indicator that uses JavaScript native number types instead of Big.js. The Parabolic SAR indicator identifies potential price reversals and can be used to determine trend direction, set trailing stop-loss orders, and identify entry/exit points.

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)\<[`HighLowNumber`](../types/HighLowNumber.md)\>

  ↳ **`FasterPSAR`**

## Table of contents

### Constructors

- [constructor](FasterPSAR.md#constructor)

### Properties

- [accelerationStep](FasterPSAR.md#accelerationstep)
- [accelerationMax](FasterPSAR.md#accelerationmax)

### Accessors

- [isStable](FasterPSAR.md#isstable)

### Methods

- [update](FasterPSAR.md#update)
- [getResultOrThrow](FasterPSAR.md#getresultorthrow)

## Constructors

### constructor

• **new FasterPSAR**(`config`)

#### Parameters

| Name     | Type         | Description                                                                          |
| :------- | :----------- | :----------------------------------------------------------------------------------- |
| `config` | `PSARConfig` | Configuration object containing acceleration step and max acceleration factor values |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

## Properties

### accelerationStep

• `Private` `Readonly` **accelerationStep**: `number`

The acceleration factor step - how quickly the SAR accelerates towards the price

### accelerationMax

• `Private` `Readonly` **accelerationMax**: `number`

The maximum value the acceleration factor can reach

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

Whether the indicator has calculated at least one result

## Methods

### update

▸ **update**(`candle`, `replace`): `number` | `null`

Update the indicator's state with a new candle

#### Parameters

| Name      | Type            | Description                               |
| :-------- | :-------------- | :---------------------------------------- |
| `candle`  | `HighLowNumber` | The new price candle with high/low values |
| `replace` | `boolean`       | Whether to replace the last candle        |

#### Returns

`number` | `null`

The updated SAR value or null if insufficient data

### getResultOrThrow

▸ **getResultOrThrow**(): `number`

Get the current result or throw an error if the indicator is not stable

#### Returns

`number`

The current SAR value

#### Throws

`NotEnoughDataError`

If there is not enough data to calculate the SAR (at least 2 candles required)

## Performance Considerations

The FasterPSAR implementation is optimized for performance and should be preferred in scenarios where computational efficiency is more important than decimal precision. It's especially suitable for backtesting with large datasets or real-time trading applications with limited resources.
