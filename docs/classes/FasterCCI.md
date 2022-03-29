[trading-signals](../README.md) / [Exports](../modules.md) / FasterCCI

# Class: FasterCCI

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)<[`HighLowCloseNumber`](../modules.md#highlowclosenumber)\>

  ↳ **`FasterCCI`**

## Table of contents

### Constructors

- [constructor](FasterCCI.md#constructor)

### Properties

- [highest](FasterCCI.md#highest)
- [interval](FasterCCI.md#interval)
- [lowest](FasterCCI.md#lowest)
- [prices](FasterCCI.md#prices)

### Accessors

- [isStable](FasterCCI.md#isstable)

### Methods

- [getResult](FasterCCI.md#getresult)
- [update](FasterCCI.md#update)

## Constructors

### constructor

• **new FasterCCI**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[CCI/CCI.ts:62](https://github.com/bennycode/trading-signals/blob/95cb489/src/CCI/CCI.ts#L62)

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

[CCI/CCI.ts:57](https://github.com/bennycode/trading-signals/blob/95cb489/src/CCI/CCI.ts#L57)

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

[CCI/CCI.ts:67](https://github.com/bennycode/trading-signals/blob/95cb489/src/CCI/CCI.ts#L67)
