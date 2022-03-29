[trading-signals](../README.md) / [Exports](../modules.md) / FasterATR

# Class: FasterATR

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)<[`HighLowCloseNumber`](../modules.md#highlowclosenumber)\>

  ↳ **`FasterATR`**

## Table of contents

### Constructors

- [constructor](FasterATR.md#constructor)

### Properties

- [highest](FasterATR.md#highest)
- [interval](FasterATR.md#interval)
- [lowest](FasterATR.md#lowest)

### Accessors

- [isStable](FasterATR.md#isstable)

### Methods

- [getResult](FasterATR.md#getresult)
- [update](FasterATR.md#update)

## Constructors

### constructor

• **new FasterATR**(`interval`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                                 | Default value |
| :------------------- | :------------------------------------------------------------------- | :------------ |
| `interval`           | `number`                                                             | `undefined`   |
| `SmoothingIndicator` | [`FasterMovingAverageTypes`](../modules.md#fastermovingaveragetypes) | `FasterWSMA`  |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[ATR/ATR.ts:42](https://github.com/bennycode/trading-signals/blob/95cb489/src/ATR/ATR.ts#L42)

## Properties

### highest

• `Optional` **highest**: `number`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[highest](NumberIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:56](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L56)

---

### interval

• `Readonly` **interval**: `number`

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

▸ **update**(`candle`): `number` \| `void`

#### Parameters

| Name     | Type                                                     |
| :------- | :------------------------------------------------------- |
| `candle` | [`HighLowCloseNumber`](../modules.md#highlowclosenumber) |

#### Returns

`number` \| `void`

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[update](NumberIndicatorSeries.md#update)

#### Defined in

[ATR/ATR.ts:48](https://github.com/bennycode/trading-signals/blob/95cb489/src/ATR/ATR.ts#L48)
