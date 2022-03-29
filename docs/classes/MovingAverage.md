[trading-signals](../README.md) / [Exports](../modules.md) / MovingAverage

# Class: MovingAverage

Moving Average (MA) Type: Trend

Base class for trend-following (lagging) indicators. The longer the moving average interval, the greater the lag.

**`see`** https://www.investopedia.com/terms/m/movingaverage.asp

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)

  ↳ **`MovingAverage`**

  ↳↳ [`EMA`](EMA.md)

  ↳↳ [`SMA`](SMA.md)

  ↳↳ [`WSMA`](WSMA.md)

## Table of contents

### Constructors

- [constructor](MovingAverage.md#constructor)

### Properties

- [highest](MovingAverage.md#highest)
- [interval](MovingAverage.md#interval)
- [lowest](MovingAverage.md#lowest)

### Accessors

- [isStable](MovingAverage.md#isstable)

### Methods

- [getResult](MovingAverage.md#getresult)
- [update](MovingAverage.md#update)

## Constructors

### constructor

• **new MovingAverage**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[MA/MovingAverage.ts:13](https://github.com/bennycode/trading-signals/blob/95cb489/src/MA/MovingAverage.ts#L13)

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

▸ `Abstract` **update**(`price`): `void` \| `Big`

#### Parameters

| Name    | Type        |
| :------ | :---------- |
| `price` | `BigSource` |

#### Returns

`void` \| `Big`

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[update](BigIndicatorSeries.md#update)

#### Defined in

[MA/MovingAverage.ts:17](https://github.com/bennycode/trading-signals/blob/95cb489/src/MA/MovingAverage.ts#L17)
