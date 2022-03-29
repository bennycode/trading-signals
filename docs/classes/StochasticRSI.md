[trading-signals](../README.md) / [Exports](../modules.md) / StochasticRSI

# Class: StochasticRSI

Stochastic RSI (STOCHRSI) Type: Momentum

The Stochastic RSI is an oscillator ranging from 0 to 1 and was developed by Tushar S. Chande and Stanley Kroll. Compared to the RSI, the Stochastic RSI is much steeper and often resides at the extremes (0 or 1). It can be used to identify short-term trends.

- A return value of 0.2 or below indicates an oversold condition
- A return value of 0.8 or above indicates an overbought condition
- Overbought doesn't mean that the price will reverse lower but it shows that the RSI reached an extreme
- Oversold doesn't mean that the price will reverse higher but it shows that the RSI reached an extreme

**`see`** https://www.investopedia.com/terms/s/stochrsi.asp

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)

  ↳ **`StochasticRSI`**

## Table of contents

### Constructors

- [constructor](StochasticRSI.md#constructor)

### Properties

- [highest](StochasticRSI.md#highest)
- [interval](StochasticRSI.md#interval)
- [lowest](StochasticRSI.md#lowest)

### Accessors

- [isStable](StochasticRSI.md#isstable)

### Methods

- [getResult](StochasticRSI.md#getresult)
- [update](StochasticRSI.md#update)

## Constructors

### constructor

• **new StochasticRSI**(`interval`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                     | Default value |
| :------------------- | :------------------------------------------------------- | :------------ |
| `interval`           | `number`                                                 | `undefined`   |
| `SmoothingIndicator` | [`MovingAverageTypes`](../modules.md#movingaveragetypes) | `WSMA`        |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[STOCH/StochasticRSI.ts:27](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticRSI.ts#L27)

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

[STOCH/StochasticRSI.ts:33](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticRSI.ts#L33)
