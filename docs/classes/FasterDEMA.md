[trading-signals](../README.md) / [Exports](../modules.md) / FasterDEMA

# Class: FasterDEMA

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)

  ↳ **`FasterDEMA`**

## Table of contents

### Constructors

- [constructor](FasterDEMA.md#constructor)

### Properties

- [highest](FasterDEMA.md#highest)
- [interval](FasterDEMA.md#interval)
- [lowest](FasterDEMA.md#lowest)

### Accessors

- [isStable](FasterDEMA.md#isstable)

### Methods

- [getResult](FasterDEMA.md#getresult)
- [update](FasterDEMA.md#update)

## Constructors

### constructor

• **new FasterDEMA**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[DEMA/DEMA.ts:40](https://github.com/bennycode/trading-signals/blob/95cb489/src/DEMA/DEMA.ts#L40)

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

#### Overrides

NumberIndicatorSeries.isStable

#### Defined in

[DEMA/DEMA.ts:52](https://github.com/bennycode/trading-signals/blob/95cb489/src/DEMA/DEMA.ts#L52)

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

▸ **update**(`price`): `number`

#### Parameters

| Name    | Type     |
| :------ | :------- |
| `price` | `number` |

#### Returns

`number`

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[update](NumberIndicatorSeries.md#update)

#### Defined in

[DEMA/DEMA.ts:46](https://github.com/bennycode/trading-signals/blob/95cb489/src/DEMA/DEMA.ts#L46)
