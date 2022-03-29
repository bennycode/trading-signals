[trading-signals](../README.md) / [Exports](../modules.md) / TR

# Class: TR

True Range (TR) Type: Volatility

The True Range (TR) was developed by **John Welles Wilder, Jr.**. The range (R) is a candle's highest price minus it's lowest price. The true range extends it to yesterday's closing price if it was outside of the current range.

Low return values indicate a sideways trend with little volatility.

**`see`** https://www.linnsoft.com/techind/true-range-tr

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)<[`HighLowClose`](../modules.md#highlowclose)\>

  ↳ **`TR`**

## Table of contents

### Constructors

- [constructor](TR.md#constructor)

### Properties

- [highest](TR.md#highest)
- [lowest](TR.md#lowest)

### Accessors

- [isStable](TR.md#isstable)

### Methods

- [getResult](TR.md#getresult)
- [update](TR.md#update)

## Constructors

### constructor

• **new TR**()

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

## Properties

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

▸ **update**(`candle`): `Big`

#### Parameters

| Name     | Type                                         |
| :------- | :------------------------------------------- |
| `candle` | [`HighLowClose`](../modules.md#highlowclose) |

#### Returns

`Big`

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[update](BigIndicatorSeries.md#update)

#### Defined in

[TR/TR.ts:19](https://github.com/bennycode/trading-signals/blob/95cb489/src/TR/TR.ts#L19)
