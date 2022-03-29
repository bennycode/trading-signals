[trading-signals](../README.md) / [Exports](../modules.md) / FasterDX

# Class: FasterDX

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)<[`HighLowCloseNumber`](../modules.md#highlowclosenumber)\>

  ↳ **`FasterDX`**

## Table of contents

### Constructors

- [constructor](FasterDX.md#constructor)

### Properties

- [highest](FasterDX.md#highest)
- [interval](FasterDX.md#interval)
- [lowest](FasterDX.md#lowest)
- [mdi](FasterDX.md#mdi)
- [pdi](FasterDX.md#pdi)

### Accessors

- [isStable](FasterDX.md#isstable)

### Methods

- [getResult](FasterDX.md#getresult)
- [update](FasterDX.md#update)

## Constructors

### constructor

• **new FasterDX**(`interval`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                                 | Default value |
| :------------------- | :------------------------------------------------------------------- | :------------ |
| `interval`           | `number`                                                             | `undefined`   |
| `SmoothingIndicator` | [`FasterMovingAverageTypes`](../modules.md#fastermovingaveragetypes) | `FasterWSMA`  |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[DX/DX.ts:100](https://github.com/bennycode/trading-signals/blob/95cb489/src/DX/DX.ts#L100)

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

---

### mdi

• `Optional` **mdi**: `number`

#### Defined in

[DX/DX.ts:97](https://github.com/bennycode/trading-signals/blob/95cb489/src/DX/DX.ts#L97)

---

### pdi

• `Optional` **pdi**: `number`

#### Defined in

[DX/DX.ts:98](https://github.com/bennycode/trading-signals/blob/95cb489/src/DX/DX.ts#L98)

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

[DX/DX.ts:114](https://github.com/bennycode/trading-signals/blob/95cb489/src/DX/DX.ts#L114)
