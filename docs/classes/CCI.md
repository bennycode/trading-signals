[trading-signals](../README.md) / [Exports](../modules.md) / CCI

# Class: CCI

Commodity Channel Index (CCI) Type: Momentum

The Commodity Channel Index (CCI), developed by Donald Lambert in 1980, compares the current mean price with the average mean price over a period of time. Approximately 70 to 80 percent of CCI values are between −100 and +100, which makes it an oscillator. Values above +100 imply an overbought condition, while values below −100 imply an oversold condition.

According to [Investopia.com](https://www.investopedia.com/articles/active-trading/031914/how-traders-can-utilize-cci-commodity-channel-index-trade-stock-trends.asp#multiple-timeframe-cci-strategy), traders often buy when the CCI dips below -100 and then rallies back above -100 to sell the security when it moves above +100 and then drops back below +100.

**`see`** https://en.wikipedia.org/wiki/Commodity_channel_index

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)<[`HighLowClose`](../modules.md#highlowclose)\>

  ↳ **`CCI`**

## Table of contents

### Constructors

- [constructor](CCI.md#constructor)

### Properties

- [highest](CCI.md#highest)
- [interval](CCI.md#interval)
- [lowest](CCI.md#lowest)
- [prices](CCI.md#prices)

### Accessors

- [isStable](CCI.md#isstable)

### Methods

- [getResult](CCI.md#getresult)
- [update](CCI.md#update)

## Constructors

### constructor

• **new CCI**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[CCI/CCI.ts:29](https://github.com/bennycode/trading-signals/blob/95cb489/src/CCI/CCI.ts#L29)

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

### prices

• `Readonly` **prices**: `BigSource`[] = `[]`

#### Defined in

[CCI/CCI.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/CCI/CCI.ts#L24)

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

[CCI/CCI.ts:34](https://github.com/bennycode/trading-signals/blob/95cb489/src/CCI/CCI.ts#L34)
