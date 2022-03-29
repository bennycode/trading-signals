[trading-signals](../README.md) / [Exports](../modules.md) / FasterAO

# Class: FasterAO

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)<[`HighLowNumber`](../modules.md#highlownumber)\>

  ↳ **`FasterAO`**

## Table of contents

### Constructors

- [constructor](FasterAO.md#constructor)

### Properties

- [highest](FasterAO.md#highest)
- [long](FasterAO.md#long)
- [longInterval](FasterAO.md#longinterval)
- [lowest](FasterAO.md#lowest)
- [short](FasterAO.md#short)
- [shortInterval](FasterAO.md#shortinterval)

### Accessors

- [isStable](FasterAO.md#isstable)

### Methods

- [getResult](FasterAO.md#getresult)
- [update](FasterAO.md#update)

## Constructors

### constructor

• **new FasterAO**(`shortInterval`, `longInterval`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                                 | Default value |
| :------------------- | :------------------------------------------------------------------- | :------------ |
| `shortInterval`      | `number`                                                             | `undefined`   |
| `longInterval`       | `number`                                                             | `undefined`   |
| `SmoothingIndicator` | [`FasterMovingAverageTypes`](../modules.md#fastermovingaveragetypes) | `FasterSMA`   |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[AO/AO.ts:53](https://github.com/bennycode/trading-signals/blob/95cb489/src/AO/AO.ts#L53)

## Properties

### highest

• `Optional` **highest**: `number`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[highest](NumberIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:56](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L56)

---

### long

• `Readonly` **long**: [`FasterMovingAverage`](FasterMovingAverage.md)

#### Defined in

[AO/AO.ts:50](https://github.com/bennycode/trading-signals/blob/95cb489/src/AO/AO.ts#L50)

---

### longInterval

• `Readonly` **longInterval**: `number`

---

### lowest

• `Optional` **lowest**: `number`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[lowest](NumberIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:58](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L58)

---

### short

• `Readonly` **short**: [`FasterMovingAverage`](FasterMovingAverage.md)

#### Defined in

[AO/AO.ts:51](https://github.com/bennycode/trading-signals/blob/95cb489/src/AO/AO.ts#L51)

---

### shortInterval

• `Readonly` **shortInterval**: `number`

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

▸ **update**(`__namedParameters`): `number` \| `void`

#### Parameters

| Name                | Type                                           |
| :------------------ | :--------------------------------------------- |
| `__namedParameters` | [`HighLowNumber`](../modules.md#highlownumber) |

#### Returns

`number` \| `void`

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[update](NumberIndicatorSeries.md#update)

#### Defined in

[AO/AO.ts:63](https://github.com/bennycode/trading-signals/blob/95cb489/src/AO/AO.ts#L63)
