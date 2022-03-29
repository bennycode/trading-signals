[trading-signals](../README.md) / [Exports](../modules.md) / MAD

# Class: MAD

Mean Absolute Deviation (MAD) Type: Volatility

The mean absolute deviation (MAD) is calculating the absolute deviation / difference from the mean over a period. Large outliers will reflect in a higher MAD.

**`see`** https://en.wikipedia.org/wiki/Average_absolute_deviation

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)

  ↳ **`MAD`**

## Table of contents

### Constructors

- [constructor](MAD.md#constructor)

### Properties

- [highest](MAD.md#highest)
- [interval](MAD.md#interval)
- [lowest](MAD.md#lowest)
- [prices](MAD.md#prices)

### Accessors

- [isStable](MAD.md#isstable)

### Methods

- [getResult](MAD.md#getresult)
- [update](MAD.md#update)
- [getResultFromBatch](MAD.md#getresultfrombatch)

## Constructors

### constructor

• **new MAD**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[MAD/MAD.ts:17](https://github.com/bennycode/trading-signals/blob/95cb489/src/MAD/MAD.ts#L17)

## Properties

### highest

• `Optional` **highest**: `Big`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[highest](BigIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L22)

---

### interval

• `Readonly` **interval**: `number`

---

### lowest

• `Optional` **lowest**: `Big`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[lowest](BigIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L24)

---

### prices

• `Readonly` **prices**: `BigSource`[] = `[]`

#### Defined in

[MAD/MAD.ts:15](https://github.com/bennycode/trading-signals/blob/95cb489/src/MAD/MAD.ts#L15)

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

▸ **update**(`price`): `void` \| `Big`

#### Parameters

| Name    | Type        |
| :------ | :---------- |
| `price` | `BigSource` |

#### Returns

`void` \| `Big`

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[update](BigIndicatorSeries.md#update)

#### Defined in

[MAD/MAD.ts:21](https://github.com/bennycode/trading-signals/blob/95cb489/src/MAD/MAD.ts#L21)

---

### getResultFromBatch

▸ `Static` **getResultFromBatch**(`prices`, `average?`): `Big`

#### Parameters

| Name       | Type          |
| :--------- | :------------ |
| `prices`   | `BigSource`[] |
| `average?` | `BigSource`   |

#### Returns

`Big`

#### Defined in

[MAD/MAD.ts:33](https://github.com/bennycode/trading-signals/blob/95cb489/src/MAD/MAD.ts#L33)
