[trading-signals](../README.md) / [Exports](../modules.md) / RSI

# Class: RSI

Relative Strength Index (RSI) Type: Momentum

The Relative Strength Index (RSI) is an oscillator that ranges between 0 and 100. The RSI can be used to find trend reversals, i.e. when a downtrend doesn't generate a RSI below 30 and rallies above 70 it could mean that a trend reversal to the upside is taking place. Trend lines and moving averages should be used to validate such statements.

The RSI is mostly useful in markets that alternate between bullish and bearish movements.

A RSI value of 30 or below indicates an oversold condition (not a good time to sell because there is an oversupply). A RSI value of 70 or above indicates an overbought condition (sell high opportunity because market may correct the price in the near future).

**`see`** https://en.wikipedia.org/wiki/Relative_strength_index

**`see`** https://www.investopedia.com/terms/r/rsi.asp

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)

  ↳ **`RSI`**

## Table of contents

### Constructors

- [constructor](RSI.md#constructor)

### Properties

- [highest](RSI.md#highest)
- [interval](RSI.md#interval)
- [lowest](RSI.md#lowest)

### Accessors

- [isStable](RSI.md#isstable)

### Methods

- [getResult](RSI.md#getresult)
- [update](RSI.md#update)

## Constructors

### constructor

• **new RSI**(`interval`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                     | Default value |
| :------------------- | :------------------------------------------------------- | :------------ |
| `interval`           | `number`                                                 | `undefined`   |
| `SmoothingIndicator` | [`MovingAverageTypes`](../modules.md#movingaveragetypes) | `WSMA`        |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[RSI/RSI.ts:30](https://github.com/bennycode/trading-signals/blob/95cb489/src/RSI/RSI.ts#L30)

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

[RSI/RSI.ts:36](https://github.com/bennycode/trading-signals/blob/95cb489/src/RSI/RSI.ts#L36)
