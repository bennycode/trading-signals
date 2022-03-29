[trading-signals](../README.md) / [Exports](../modules.md) / FasterAccelerationBands

# Class: FasterAccelerationBands

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`FasterBandsResult`](../interfaces/FasterBandsResult.md), [`HighLowCloseNumber`](../modules.md#highlowclosenumber)\>

## Table of contents

### Constructors

- [constructor](FasterAccelerationBands.md#constructor)

### Properties

- [interval](FasterAccelerationBands.md#interval)
- [width](FasterAccelerationBands.md#width)

### Accessors

- [isStable](FasterAccelerationBands.md#isstable)

### Methods

- [getResult](FasterAccelerationBands.md#getresult)
- [update](FasterAccelerationBands.md#update)

## Constructors

### constructor

• **new FasterAccelerationBands**(`interval`, `width`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                                 | Default value |
| :------------------- | :------------------------------------------------------------------- | :------------ |
| `interval`           | `number`                                                             | `undefined`   |
| `width`              | `number`                                                             | `undefined`   |
| `SmoothingIndicator` | [`FasterMovingAverageTypes`](../modules.md#fastermovingaveragetypes) | `FasterSMA`   |

#### Defined in

[ABANDS/AccelerationBands.ts:79](https://github.com/bennycode/trading-signals/blob/95cb489/src/ABANDS/AccelerationBands.ts#L79)

## Properties

### interval

• `Readonly` **interval**: `number`

---

### width

• `Readonly` **width**: `number`

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[ABANDS/AccelerationBands.ts:98](https://github.com/bennycode/trading-signals/blob/95cb489/src/ABANDS/AccelerationBands.ts#L98)

## Methods

### getResult

▸ **getResult**(): [`FasterBandsResult`](../interfaces/FasterBandsResult.md)

#### Returns

[`FasterBandsResult`](../interfaces/FasterBandsResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[ABANDS/AccelerationBands.ts:102](https://github.com/bennycode/trading-signals/blob/95cb489/src/ABANDS/AccelerationBands.ts#L102)

---

### update

▸ **update**(`__namedParameters`): `void`

#### Parameters

| Name                | Type                                                     |
| :------------------ | :------------------------------------------------------- |
| `__namedParameters` | [`HighLowCloseNumber`](../modules.md#highlowclosenumber) |

#### Returns

`void`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[ABANDS/AccelerationBands.ts:89](https://github.com/bennycode/trading-signals/blob/95cb489/src/ABANDS/AccelerationBands.ts#L89)
