[trading-signals](../README.md) / [Exports](../modules.md) / PSAR

# Class: PSAR

Parabolic SAR (PSAR) Type: Trend

The Parabolic Stop and Reverse (PSAR) is a technical indicator that identifies potential reversals in the price movement of an asset. It appears as a series of dots placed either above or below the price, depending on the direction the price is moving. The indicator is used to determine the direction of a trend, identify potential entry and exit points, and set trailing stop-loss orders.

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)\<[`HighLow`](../types/HighLow.md)\>

  ↳ **`PSAR`**

## Table of contents

### Constructors

- [constructor](PSAR.md#constructor)

### Properties

- [accelerationStep](PSAR.md#accelerationstep)
- [accelerationMax](PSAR.md#accelerationmax)

### Accessors

- [isStable](PSAR.md#isstable)

### Methods

- [update](PSAR.md#update)
- [getResultOrThrow](PSAR.md#getresultorthrow)

## Constructors

### constructor

• **new PSAR**(`config`)

#### Parameters

| Name     | Type         | Description                                                                          |
| :------- | :----------- | :----------------------------------------------------------------------------------- |
| `config` | `PSARConfig` | Configuration object containing acceleration step and max acceleration factor values |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

## Properties

### accelerationStep

• `Private` `Readonly` **accelerationStep**: `Big`

The acceleration factor step - how quickly the SAR accelerates towards the price

### accelerationMax

• `Private` `Readonly` **accelerationMax**: `Big`

The maximum value the acceleration factor can reach

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

Whether the indicator has calculated at least one result

## Methods

### update

▸ **update**(`candle`, `replace`): `Big` | `null`

Update the indicator's state with a new candle

#### Parameters

| Name      | Type      | Description                               |
| :-------- | :-------- | :---------------------------------------- |
| `candle`  | `HighLow` | The new price candle with high/low values |
| `replace` | `boolean` | Whether to replace the last candle        |

#### Returns

`Big` | `null`

The updated SAR value or null if insufficient data

### getResultOrThrow

▸ **getResultOrThrow**(): `Big`

Get the current result or throw an error if the indicator is not stable

#### Returns

`Big`

The current SAR value

#### Throws

`NotEnoughDataError`

If there is not enough data to calculate the SAR (at least 2 candles required)

# Class: FasterPSAR

A faster implementation of PSAR using number type instead of Big.js for calculations.

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)\<[`HighLowNumber`](../types/HighLowNumber.md)\>

  ↳ **`FasterPSAR`**

## Description

This implementation provides the same functionality as PSAR but uses native JavaScript numbers instead of Big.js for better performance. The indicator requires at least two candles to produce a valid result.
