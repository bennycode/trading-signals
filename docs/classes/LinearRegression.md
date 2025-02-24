[trading-signals](../README.md) / [Exports](../modules.md) / LinearRegression

# Class: LinearRegression

Linear Regression (LinearRegression) Type: Trend

Linear regression is a statistical method used to find relationships between variables. In trading, it is used to identify and analyze price trends by fitting a straight line through a set of data points. This implementation calculates the basic regression line parameters (slope, intercept) and predicts the next value.

## Hierarchy

- [`TechnicalIndicator`](TechnicalIndicator.md)\<[`LinearRegressionResult`](../interfaces/LinearRegressionResult.md), `BigSource`\>

  ↳ **`LinearRegression`**

## Table of contents

### Constructors

- [constructor](LinearRegression.md#constructor)

### Properties

- [prices](LinearRegression.md#prices)
- [period](LinearRegression.md#period)

### Accessors

- [isStable](LinearRegression.md#isstable)

### Methods

- [update](LinearRegression.md#update)
- [getResultOrThrow](LinearRegression.md#getresultorthrow)

## Constructors

### constructor

• **new LinearRegression**(`config`)

#### Parameters

| Name     | Type                     | Description                                                        |
| :------- | :----------------------- | :----------------------------------------------------------------- |
| `config` | `LinearRegressionConfig` | Configuration object containing the period for regression analysis |

#### Overrides

[TechnicalIndicator](TechnicalIndicator.md).[constructor](TechnicalIndicator.md#constructor)

## Properties

### prices

• `Readonly` **prices**: `BigSource`[] = `[]`

Array of price values used in the calculation

### period

• `Private` `Readonly` **period**: `number`

The number of periods to analyze

## Methods

### update

▸ **update**(`price`, `replace`): `LinearRegressionResult` | `null`

Update the indicator's state with a new price value

#### Parameters

| Name      | Type        | Description                       |
| :-------- | :---------- | :-------------------------------- |
| `price`   | `BigSource` | The new price value               |
| `replace` | `boolean`   | Whether to replace the last value |

#### Returns

`LinearRegressionResult` | `null`

The updated regression results or null if insufficient data

### getResultOrThrow

▸ **getResultOrThrow**(): `LinearRegressionResult`

Get the current result or throw an error if the indicator is not stable

#### Returns

`LinearRegressionResult`

The current regression results containing slope, intercept, and prediction

#### Throws

`NotEnoughDataError`

If there is not enough data to calculate the regression

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

Whether the indicator has enough data to provide stable results

# Class: FasterLinearRegression

A faster implementation of LinearRegression using number type instead of Big.js for calculations.

## Hierarchy

- [`TechnicalIndicator`](TechnicalIndicator.md)\<[`FasterLinearRegressionResult`](../interfaces/FasterLinearRegressionResult.md), `number`\>

  ↳ **`FasterLinearRegression`**

## Description

This implementation provides the same functionality as LinearRegression but uses native JavaScript numbers instead of Big.js for better performance. It includes special optimizations for perfect linear trends.
