[trading-signals](../README.md) / [Exports](../modules.md) / DX

# Class: DX

Directional Movement Index (DMI / DX) Type: Momentum, Trend (using +DI & -DI)

The DX was developed by **John Welles Wilder, Jr.**. and may help traders assess the strength of a trend (momentum) and direction of the trend.

If there is no change in the trend, then the DX is `0`. The return value increases when there is a stronger trend (either negative or positive). To detect if the trend is bullish or bearish you have to compare +DI and -DI. When +DI is above -DI, then there is more upward pressure than downward pressure in the market.

**`see`** https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/dmi

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)<[`HighLowClose`](../modules.md#highlowclose)\>

  ↳ **`DX`**

## Table of contents

### Constructors

- [constructor](DX.md#constructor)

### Properties

- [highest](DX.md#highest)
- [interval](DX.md#interval)
- [lowest](DX.md#lowest)
- [mdi](DX.md#mdi)
- [pdi](DX.md#pdi)

### Accessors

- [isStable](DX.md#isstable)

### Methods

- [getResult](DX.md#getresult)
- [update](DX.md#update)

## Constructors

### constructor

• **new DX**(`interval`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                     | Default value |
| :------------------- | :------------------------------------------------------- | :------------ |
| `interval`           | `number`                                                 | `undefined`   |
| `SmoothingIndicator` | [`MovingAverageTypes`](../modules.md#movingaveragetypes) | `WSMA`        |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[DX/DX.ts:32](https://github.com/bennycode/trading-signals/blob/95cb489/src/DX/DX.ts#L32)

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

### mdi

• `Optional` **mdi**: `Big`

Minus Directional Indicator (-DI)

#### Defined in

[DX/DX.ts:28](https://github.com/bennycode/trading-signals/blob/95cb489/src/DX/DX.ts#L28)

---

### pdi

• `Optional` **pdi**: `Big`

Plus Directional Indicator (+DI)

#### Defined in

[DX/DX.ts:30](https://github.com/bennycode/trading-signals/blob/95cb489/src/DX/DX.ts#L30)

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

[DX/DX.ts:46](https://github.com/bennycode/trading-signals/blob/95cb489/src/DX/DX.ts#L46)
