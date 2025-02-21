[trading-signals](../README.md) / [Exports](../modules.md) / LINREG

# Class: LINREG

Linear Regression (LINREG) Type: Trend

Linear regression is a statistical method used to find relationships between variables. In trading, it is used to identify and analyze price trends by fitting a straight line through a set of data points. This implementation provides both the regression line parameters and statistical measures of fit.

## Hierarchy

- [`TechnicalIndicator`](TechnicalIndicator.md)\<[`LINREGResult`](../interfaces/LINREGResult.md), `BigSource`\>

  ↳ **`LINREG`**

## Table of contents

### Constructors

- [constructor](LINREG.md#constructor)

### Properties

- [prices](LINREG.md#prices)
- [period](LINREG.md#period)

### Accessors

- [isStable](LINREG.md#isstable)

### Methods

- [update](LINREG.md#update)
- [getResultOrThrow](LINREG.md#getresultorthrow)

## Constructors

### constructor

• **new LINREG**(`config`)

#### Parameters

| Name     | Type           | Description                            |
| :------- | :------------- | :------------------------------------- |
| `config` | `LINREGConfig` | Configuration for the LINREG indicator |

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

▸ **update**(`price`, `replace`): `LINREGResult` | `null`

Update the indicator's state with a new price value

#### Parameters

| Name      | Type        | Description                       |
| :-------- | :---------- | :-------------------------------- |
| `price`   | `BigSource` | The new price value               |
| `replace` | `boolean`   | Whether to replace the last value |

#### Returns

`LINREGResult` | `null`

The updated regression results or null if insufficient data

### getResultOrThrow

▸ **getResultOrThrow**(): `LINREGResult`

Get the current result or throw an error if the indicator is not stable

#### Returns

`LINREGResult`

The current regression results

#### Throws

`NotEnoughDataError`

If there is not enough data to calculate the regression

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

Whether the indicator has enough data to provide stable results
