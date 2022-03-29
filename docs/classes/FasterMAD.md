[trading-signals](../README.md) / [Exports](../modules.md) / FasterMAD

# Class: FasterMAD

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)

  ↳ **`FasterMAD`**

## Table of contents

### Constructors

- [constructor](FasterMAD.md#constructor)

### Properties

- [highest](FasterMAD.md#highest)
- [interval](FasterMAD.md#interval)
- [lowest](FasterMAD.md#lowest)
- [prices](FasterMAD.md#prices)

### Accessors

- [isStable](FasterMAD.md#isstable)

### Methods

- [getResult](FasterMAD.md#getresult)
- [update](FasterMAD.md#update)
- [getResultFromBatch](FasterMAD.md#getresultfrombatch)

## Constructors

### constructor

• **new FasterMAD**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[MAD/MAD.ts:47](https://github.com/bennycode/trading-signals/blob/95cb489/src/MAD/MAD.ts#L47)

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

### prices

• `Readonly` **prices**: `number`[] = `[]`

#### Defined in

[MAD/MAD.ts:45](https://github.com/bennycode/trading-signals/blob/95cb489/src/MAD/MAD.ts#L45)

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

▸ **update**(`price`): `number` \| `void`

#### Parameters

| Name    | Type     |
| :------ | :------- |
| `price` | `number` |

#### Returns

`number` \| `void`

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[update](NumberIndicatorSeries.md#update)

#### Defined in

[MAD/MAD.ts:51](https://github.com/bennycode/trading-signals/blob/95cb489/src/MAD/MAD.ts#L51)

---

### getResultFromBatch

▸ `Static` **getResultFromBatch**(`prices`, `average?`): `number`

#### Parameters

| Name       | Type       |
| :--------- | :--------- |
| `prices`   | `number`[] |
| `average?` | `number`   |

#### Returns

`number`

#### Defined in

[MAD/MAD.ts:69](https://github.com/bennycode/trading-signals/blob/95cb489/src/MAD/MAD.ts#L69)
