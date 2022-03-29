[trading-signals](../README.md) / [Exports](../modules.md) / FasterROC

# Class: FasterROC

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)

  ↳ **`FasterROC`**

## Table of contents

### Constructors

- [constructor](FasterROC.md#constructor)

### Properties

- [highest](FasterROC.md#highest)
- [interval](FasterROC.md#interval)
- [lowest](FasterROC.md#lowest)
- [prices](FasterROC.md#prices)

### Accessors

- [isStable](FasterROC.md#isstable)

### Methods

- [getResult](FasterROC.md#getresult)
- [update](FasterROC.md#update)

## Constructors

### constructor

• **new FasterROC**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[ROC/ROC.ts:38](https://github.com/bennycode/trading-signals/blob/95cb489/src/ROC/ROC.ts#L38)

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

[ROC/ROC.ts:36](https://github.com/bennycode/trading-signals/blob/95cb489/src/ROC/ROC.ts#L36)

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

[ROC/ROC.ts:42](https://github.com/bennycode/trading-signals/blob/95cb489/src/ROC/ROC.ts#L42)
