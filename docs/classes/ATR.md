[trading-signals](../README.md) / [Exports](../modules.md) / ATR

# Class: ATR

Average True Range (ATR) Type: Volatility

The ATR was developed by **John Welles Wilder, Jr.**. The idea of ranges is that they show the commitment or enthusiasm of traders. Large or increasing ranges suggest traders prepared to continue to bid up or sell down a stock through the course of the day. Decreasing range indicates declining interest.

**`see`** https://www.investopedia.com/terms/a/atr.asp

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)<[`HighLowClose`](../modules.md#highlowclose)\>

  ↳ **`ATR`**

## Table of contents

### Constructors

- [constructor](ATR.md#constructor)

### Properties

- [highest](ATR.md#highest)
- [interval](ATR.md#interval)
- [lowest](ATR.md#lowest)

### Accessors

- [isStable](ATR.md#isstable)

### Methods

- [getResult](ATR.md#getresult)
- [update](ATR.md#update)

## Constructors

### constructor

• **new ATR**(`interval`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                     | Default value |
| :------------------- | :------------------------------------------------------- | :------------ |
| `interval`           | `number`                                                 | `undefined`   |
| `SmoothingIndicator` | [`MovingAverageTypes`](../modules.md#movingaveragetypes) | `WSMA`        |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[ATR/ATR.ts:23](https://github.com/bennycode/trading-signals/blob/95cb489/src/ATR/ATR.ts#L23)

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

[ATR/ATR.ts:29](https://github.com/bennycode/trading-signals/blob/95cb489/src/ATR/ATR.ts#L29)
