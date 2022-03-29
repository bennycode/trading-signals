[trading-signals](../README.md) / [Exports](../modules.md) / FasterTR

# Class: FasterTR

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)<[`HighLowCloseNumber`](../modules.md#highlowclosenumber)\>

  ↳ **`FasterTR`**

## Table of contents

### Constructors

- [constructor](FasterTR.md#constructor)

### Properties

- [highest](FasterTR.md#highest)
- [lowest](FasterTR.md#lowest)

### Accessors

- [isStable](FasterTR.md#isstable)

### Methods

- [getResult](FasterTR.md#getresult)
- [update](FasterTR.md#update)

## Constructors

### constructor

• **new FasterTR**()

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

## Properties

### highest

• `Optional` **highest**: `number`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[highest](NumberIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:56](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L56)

---

### lowest

• `Optional` **lowest**: `number`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[lowest](NumberIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:58](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L58)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Inherited from

NumberIndicatorSeries.isStable

#### Defined in

[Indicator.ts:61](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L61)

## Methods

### getResult

▸ **getResult**(): `number`

#### Returns

`number`

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[getResult](NumberIndicatorSeries.md#getresult)

#### Defined in

[Indicator.ts:65](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L65)

---

### update

▸ **update**(`candle`): `number`

#### Parameters

| Name     | Type                                                     |
| :------- | :------------------------------------------------------- |
| `candle` | [`HighLowCloseNumber`](../modules.md#highlowclosenumber) |

#### Returns

`number`

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[update](NumberIndicatorSeries.md#update)

#### Defined in

[TR/TR.ts:36](https://github.com/bennycode/trading-signals/blob/95cb489/src/TR/TR.ts#L36)
