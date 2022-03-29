[trading-signals](../README.md) / [Exports](../modules.md) / FasterBollingerBandsWidth

# Class: FasterBollingerBandsWidth

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)

  ↳ **`FasterBollingerBandsWidth`**

## Table of contents

### Constructors

- [constructor](FasterBollingerBandsWidth.md#constructor)

### Properties

- [bollingerBands](FasterBollingerBandsWidth.md#bollingerbands)
- [highest](FasterBollingerBandsWidth.md#highest)
- [lowest](FasterBollingerBandsWidth.md#lowest)

### Accessors

- [isStable](FasterBollingerBandsWidth.md#isstable)

### Methods

- [getResult](FasterBollingerBandsWidth.md#getresult)
- [update](FasterBollingerBandsWidth.md#update)

## Constructors

### constructor

• **new FasterBollingerBandsWidth**(`bollingerBands`)

#### Parameters

| Name             | Type                                              |
| :--------------- | :------------------------------------------------ |
| `bollingerBands` | [`FasterBollingerBands`](FasterBollingerBands.md) |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[BBW/BollingerBandsWidth.ts:26](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBW/BollingerBandsWidth.ts#L26)

## Properties

### bollingerBands

• `Readonly` **bollingerBands**: [`FasterBollingerBands`](FasterBollingerBands.md)

---

### highest

• `Optional` **highest**: `number`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[highest](NumberIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:56](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L56)

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

[BBW/BollingerBandsWidth.ts:30](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBW/BollingerBandsWidth.ts#L30)
