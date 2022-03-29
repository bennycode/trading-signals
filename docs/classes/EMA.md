[trading-signals](../README.md) / [Exports](../modules.md) / EMA

# Class: EMA

Exponential Moving Average (EMA) Type: Trend

Compared to SMA, the EMA puts more emphasis on the recent prices to reduce lag. Due to its responsiveness to price changes, it rises faster and falls faster than the SMA when the price is inclining or declining.

**`see`** https://www.investopedia.com/terms/e/ema.asp

## Hierarchy

- [`MovingAverage`](MovingAverage.md)

  ↳ **`EMA`**

## Table of contents

### Constructors

- [constructor](EMA.md#constructor)

### Properties

- [highest](EMA.md#highest)
- [interval](EMA.md#interval)
- [lowest](EMA.md#lowest)

### Accessors

- [isStable](EMA.md#isstable)

### Methods

- [getResult](EMA.md#getresult)
- [update](EMA.md#update)

## Constructors

### constructor

• **new EMA**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[MovingAverage](MovingAverage.md).[constructor](MovingAverage.md#constructor)

#### Defined in

[EMA/EMA.ts:17](https://github.com/bennycode/trading-signals/blob/95cb489/src/EMA/EMA.ts#L17)

## Properties

### highest

• `Optional` **highest**: `Big`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[MovingAverage](MovingAverage.md).[highest](MovingAverage.md#highest)

#### Defined in

[Indicator.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L22)

---

### interval

• `Readonly` **interval**: `number`

#### Inherited from

[MovingAverage](MovingAverage.md).[interval](MovingAverage.md#interval)

---

### lowest

• `Optional` **lowest**: `Big`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[MovingAverage](MovingAverage.md).[lowest](MovingAverage.md#lowest)

#### Defined in

[Indicator.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L24)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Overrides

MovingAverage.isStable

#### Defined in

[EMA/EMA.ts:42](https://github.com/bennycode/trading-signals/blob/95cb489/src/EMA/EMA.ts#L42)

## Methods

### getResult

▸ **getResult**(): `Big`

#### Returns

`Big`

#### Overrides

[MovingAverage](MovingAverage.md).[getResult](MovingAverage.md#getresult)

#### Defined in

[EMA/EMA.ts:34](https://github.com/bennycode/trading-signals/blob/95cb489/src/EMA/EMA.ts#L34)

---

### update

▸ **update**(`_price`): `Big`

#### Parameters

| Name     | Type        |
| :------- | :---------- |
| `_price` | `BigSource` |

#### Returns

`Big`

#### Overrides

[MovingAverage](MovingAverage.md).[update](MovingAverage.md#update)

#### Defined in

[EMA/EMA.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/EMA/EMA.ts#L22)
