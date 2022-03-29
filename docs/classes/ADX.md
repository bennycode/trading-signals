[trading-signals](../README.md) / [Exports](../modules.md) / ADX

# Class: ADX

Average Directional Index (ADX) Type: Momentum, Trend (using +DI & -DI), Volatility

The ADX was developed by **John Welles Wilder, Jr.**. It is a lagging indicator; that is, a trend must have established itself before the ADX will generate a signal that a trend is under way.

ADX will range between 0 and 100 which makes it an oscillator. It is a smoothed average of the Directional Movement Index (DMI / DX).

Generally, ADX readings below 20 indicate trend weakness, and readings above 40 indicate trend strength. A strong trend is indicated by readings above 50. ADX values of 75-100 signal an extremely strong trend.

If ADX increases, it means that volatility is increasing and indicating the beginning of a new trend. If ADX decreases, it means that volatility is decreasing, and the current trend is slowing down and may even reverse. When +DI is above -DI, then there is more upward pressure than downward pressure in the market.

**`see`** https://www.investopedia.com/terms/a/adx.asp

**`see`** https://www.youtube.com/watch?v=n2J1H3NeF70

**`see`** https://learn.tradimo.com/technical-analysis-how-to-work-with-indicators/adx-determing-the-strength-of-price-movement

**`see`** https://medium.com/codex/algorithmic-trading-with-average-directional-index-in-python-2b5a20ecf06a

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)<[`HighLowClose`](../modules.md#highlowclose)\>

  ↳ **`ADX`**

## Table of contents

### Constructors

- [constructor](ADX.md#constructor)

### Properties

- [highest](ADX.md#highest)
- [interval](ADX.md#interval)
- [lowest](ADX.md#lowest)

### Accessors

- [isStable](ADX.md#isstable)
- [mdi](ADX.md#mdi)
- [pdi](ADX.md#pdi)

### Methods

- [getResult](ADX.md#getresult)
- [update](ADX.md#update)

## Constructors

### constructor

• **new ADX**(`interval`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                     | Default value |
| :------------------- | :------------------------------------------------------- | :------------ |
| `interval`           | `number`                                                 | `undefined`   |
| `SmoothingIndicator` | [`MovingAverageTypes`](../modules.md#movingaveragetypes) | `WSMA`        |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[ADX/ADX.ts:36](https://github.com/bennycode/trading-signals/blob/95cb489/src/ADX/ADX.ts#L36)

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

---

### mdi

• `get` **mdi**(): `void` \| `Big`

#### Returns

`void` \| `Big`

#### Defined in

[ADX/ADX.ts:42](https://github.com/bennycode/trading-signals/blob/95cb489/src/ADX/ADX.ts#L42)

---

### pdi

• `get` **pdi**(): `void` \| `Big`

#### Returns

`void` \| `Big`

#### Defined in

[ADX/ADX.ts:46](https://github.com/bennycode/trading-signals/blob/95cb489/src/ADX/ADX.ts#L46)

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

▸ **update**(`candle`): `void` \| `Big`

#### Parameters

| Name     | Type                                         |
| :------- | :------------------------------------------- |
| `candle` | [`HighLowClose`](../modules.md#highlowclose) |

#### Returns

`void` \| `Big`

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[update](BigIndicatorSeries.md#update)

#### Defined in

[ADX/ADX.ts:50](https://github.com/bennycode/trading-signals/blob/95cb489/src/ADX/ADX.ts#L50)
