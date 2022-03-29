[trading-signals](../README.md) / [Exports](../modules.md) / IndicatorSeries

# Interface: IndicatorSeries<Result, Input\>

Tracks results of an indicator over time and memorizes the highest & lowest result.

## Type parameters

| Name     | Type        |
| :------- | :---------- |
| `Result` | `Big`       |
| `Input`  | `BigSource` |

## Hierarchy

- [`Indicator`](Indicator.md)<`Result`, `Input`\>

  ↳ **`IndicatorSeries`**

## Implemented by

- [`BigIndicatorSeries`](../classes/BigIndicatorSeries.md)
- [`NumberIndicatorSeries`](../classes/NumberIndicatorSeries.md)

## Table of contents

### Properties

- [highest](IndicatorSeries.md#highest)
- [isStable](IndicatorSeries.md#isstable)
- [lowest](IndicatorSeries.md#lowest)

### Methods

- [getResult](IndicatorSeries.md#getresult)
- [update](IndicatorSeries.md#update)

## Properties

### highest

• `Optional` **highest**: `Result`

#### Defined in

[Indicator.ts:16](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L16)

---

### isStable

• **isStable**: `boolean`

#### Inherited from

[Indicator](Indicator.md).[isStable](Indicator.md#isstable)

#### Defined in

[Indicator.ts:7](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L7)

---

### lowest

• `Optional` **lowest**: `Result`

#### Defined in

[Indicator.ts:17](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L17)

## Methods

### getResult

▸ **getResult**(): `Result`

#### Returns

`Result`

#### Inherited from

[Indicator](Indicator.md).[getResult](Indicator.md#getresult)

#### Defined in

[Indicator.ts:5](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L5)

---

### update

▸ **update**(`input`): `void` \| `Result`

#### Parameters

| Name    | Type    |
| :------ | :------ |
| `input` | `Input` |

#### Returns

`void` \| `Result`

#### Inherited from

[Indicator](Indicator.md).[update](Indicator.md#update)

#### Defined in

[Indicator.ts:9](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L9)
