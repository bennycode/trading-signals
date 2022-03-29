[trading-signals](../README.md) / [Exports](../modules.md) / OBV

# Class: OBV

On-Balance Volume (OBV) Type: Momentum

On-balance volume (OBV) is a technical trading momentum indicator that uses volume flow to predict changes in stock price. Joseph Granville first developed the OBV metric in the 1963 book Granville's New Key to Stock Market Profits.

**`see`** https://www.investopedia.com/terms/o/onbalancevolume.asp

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)<[`OpenHighLowCloseVolume`](../modules.md#openhighlowclosevolume)\>

  ↳ **`OBV`**

## Table of contents

### Constructors

- [constructor](OBV.md#constructor)

### Properties

- [candles](OBV.md#candles)
- [highest](OBV.md#highest)
- [lowest](OBV.md#lowest)

### Accessors

- [isStable](OBV.md#isstable)

### Methods

- [getResult](OBV.md#getresult)
- [update](OBV.md#update)

## Constructors

### constructor

• **new OBV**()

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

## Properties

### candles

• `Readonly` **candles**: [`OpenHighLowCloseVolume`](../modules.md#openhighlowclosevolume)[] = `[]`

#### Defined in

[OBV/OBV.ts:15](https://github.com/bennycode/trading-signals/blob/95cb489/src/OBV/OBV.ts#L15)

---

### highest

• `Optional` **highest**: `Big`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[highest](BigIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L22)

---

### lowest

• `Optional` **lowest**: `Big`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[lowest](BigIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L24)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Inherited from

BigIndicatorSeries.isStable

#### Defined in

[Indicator.ts:27](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L27)

## Methods

### getResult

▸ **getResult**(): `Big`

#### Returns

`Big`

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[getResult](BigIndicatorSeries.md#getresult)

#### Defined in

[Indicator.ts:31](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L31)

---

### update

▸ **update**(`candle`): `void` \| `Big`

#### Parameters

| Name     | Type                                                             |
| :------- | :--------------------------------------------------------------- |
| `candle` | [`OpenHighLowCloseVolume`](../modules.md#openhighlowclosevolume) |

#### Returns

`void` \| `Big`

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[update](BigIndicatorSeries.md#update)

#### Defined in

[OBV/OBV.ts:17](https://github.com/bennycode/trading-signals/blob/95cb489/src/OBV/OBV.ts#L17)
