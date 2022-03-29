[trading-signals](../README.md) / [Exports](../modules.md) / BollingerBandsWidth

# Class: BollingerBandsWidth

The Bollinger Bands Width (BBW) indicator, developed by John A. Bollinger, merges the information of Bollinger Bands into one definite number. It defines the narrowness of the underlying Bollinger Bands by representing the difference between the Upper Band and the Lower Band.

**`see`** https://www.tradingview.com/support/solutions/43000501972-bollinger-bands-width-bbw/

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)

  ↳ **`BollingerBandsWidth`**

## Table of contents

### Constructors

- [constructor](BollingerBandsWidth.md#constructor)

### Properties

- [bollingerBands](BollingerBandsWidth.md#bollingerbands)
- [highest](BollingerBandsWidth.md#highest)
- [lowest](BollingerBandsWidth.md#lowest)

### Accessors

- [isStable](BollingerBandsWidth.md#isstable)

### Methods

- [getResult](BollingerBandsWidth.md#getresult)
- [update](BollingerBandsWidth.md#update)

## Constructors

### constructor

• **new BollingerBandsWidth**(`bollingerBands`)

#### Parameters

| Name             | Type                                  |
| :--------------- | :------------------------------------ |
| `bollingerBands` | [`BollingerBands`](BollingerBands.md) |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[BBW/BollingerBandsWidth.ts:13](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBW/BollingerBandsWidth.ts#L13)

## Properties

### bollingerBands

• `Readonly` **bollingerBands**: [`BollingerBands`](BollingerBands.md)

---

### highest

• `Optional` **highest**: `Big`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[highest](BigIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L22)

---

### lowest

• `Optional` **lowest**: `Big`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[lowest](BigIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L24)

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

[BBW/BollingerBandsWidth.ts:17](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBW/BollingerBandsWidth.ts#L17)
