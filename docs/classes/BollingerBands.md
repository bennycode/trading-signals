[trading-signals](../README.md) / [Exports](../modules.md) / BollingerBands

# Class: BollingerBands

Bollinger Bands (BBANDS) Type: Volatility

Bollinger Bands (BBANDS), developed by John A. Bollinger, are set as an envelope around a moving average. Narrow bands indicate a sideways trend (ranging markets). To determine a breakout direction, [Investopia.com suggests](https://www.investopedia.com/articles/technical/04/030304.asp) to use the relative strength index (RSI) along with one or two volume-based indicators such as the intraday intensity index (developed by David Bostian) or the accumulation/distribution index (developed by Larry William).

When the upper and lower bands expand, there can be "M" and "W" formations. The "W" formation indicates a bullish movement and the "M" formation indicates a bearish movement.

**`see`** https://www.investopedia.com/terms/b/bollingerbands.asp

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`BandsResult`](../interfaces/BandsResult.md)\>

## Table of contents

### Constructors

- [constructor](BollingerBands.md#constructor)

### Properties

- [deviationMultiplier](BollingerBands.md#deviationmultiplier)
- [interval](BollingerBands.md#interval)
- [prices](BollingerBands.md#prices)

### Accessors

- [isStable](BollingerBands.md#isstable)

### Methods

- [getResult](BollingerBands.md#getresult)
- [update](BollingerBands.md#update)

## Constructors

### constructor

• **new BollingerBands**(`interval`, `deviationMultiplier?`)

#### Parameters

| Name | Type | Default value | Description |
| :-- | :-- | :-- | :-- |
| `interval` | `number` | `undefined` | The time period to be used in calculating the Middle Band |
| `deviationMultiplier` | `number` | `2` | The number of standard deviations away from the Middle Band that the Upper and Lower Bands should be |

#### Defined in

[BBANDS/BollingerBands.ts:32](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBANDS/BollingerBands.ts#L32)

## Properties

### deviationMultiplier

• `Readonly` **deviationMultiplier**: `number` = `2`

---

### interval

• `Readonly` **interval**: `number`

---

### prices

• `Readonly` **prices**: `Big`[] = `[]`

#### Defined in

[BBANDS/BollingerBands.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBANDS/BollingerBands.ts#L24)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[BBANDS/BollingerBands.ts:34](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBANDS/BollingerBands.ts#L34)

## Methods

### getResult

▸ **getResult**(): [`BandsResult`](../interfaces/BandsResult.md)

#### Returns

[`BandsResult`](../interfaces/BandsResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[BBANDS/BollingerBands.ts:55](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBANDS/BollingerBands.ts#L55)

---

### update

▸ **update**(`price`): `void` \| [`BandsResult`](../interfaces/BandsResult.md)

#### Parameters

| Name    | Type        |
| :------ | :---------- |
| `price` | `BigSource` |

#### Returns

`void` \| [`BandsResult`](../interfaces/BandsResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[BBANDS/BollingerBands.ts:38](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBANDS/BollingerBands.ts#L38)
