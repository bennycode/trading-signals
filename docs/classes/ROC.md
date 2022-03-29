[trading-signals](../README.md) / [Exports](../modules.md) / ROC

# Class: ROC

Rate Of Change Indicator (ROC) Type: Momentum

A positive Rate of Change (ROC) signals a high momentum and a positive trend. A decreasing ROC or even negative ROC indicates a downtrend.

**`see`** https://www.investopedia.com/terms/r/rateofchange.asp

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)

  ↳ **`ROC`**

## Table of contents

### Constructors

- [constructor](ROC.md#constructor)

### Properties

- [highest](ROC.md#highest)
- [interval](ROC.md#interval)
- [lowest](ROC.md#lowest)
- [prices](ROC.md#prices)

### Accessors

- [isStable](ROC.md#isstable)

### Methods

- [getResult](ROC.md#getresult)
- [update](ROC.md#update)

## Constructors

### constructor

• **new ROC**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[ROC/ROC.ts:16](https://github.com/bennycode/trading-signals/blob/95cb489/src/ROC/ROC.ts#L16)

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

• `Readonly` **prices**: `Big`[] = `[]`

#### Defined in

[ROC/ROC.ts:14](https://github.com/bennycode/trading-signals/blob/95cb489/src/ROC/ROC.ts#L14)

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

[ROC/ROC.ts:20](https://github.com/bennycode/trading-signals/blob/95cb489/src/ROC/ROC.ts#L20)
