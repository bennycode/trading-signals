[trading-signals](../README.md) / [Exports](../modules.md) / SMA

# Class: SMA

Simple Moving Average (SMA) Type: Trend

The Simple Moving Average (SMA) creates an average of all prices within a fixed interval. The SMA weights the prices of all periods equally which makes it not as responsive to recent prices as the EMA.

**`see`** https://www.investopedia.com/terms/s/sma.asp

## Hierarchy

- [`MovingAverage`](MovingAverage.md)

  ↳ **`SMA`**

## Table of contents

### Constructors

- [constructor](SMA.md#constructor)

### Properties

- [highest](SMA.md#highest)
- [interval](SMA.md#interval)
- [lowest](SMA.md#lowest)
- [prices](SMA.md#prices)

### Accessors

- [isStable](SMA.md#isstable)

### Methods

- [getResult](SMA.md#getresult)
- [update](SMA.md#update)
- [getResultFromBatch](SMA.md#getresultfrombatch)

## Constructors

### constructor

• **new SMA**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Inherited from

[MovingAverage](MovingAverage.md).[constructor](MovingAverage.md#constructor)

#### Defined in

[MA/MovingAverage.ts:13](https://github.com/bennycode/trading-signals/blob/95cb489/src/MA/MovingAverage.ts#L13)

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

---

### prices

• `Readonly` **prices**: `BigSource`[] = `[]`

#### Defined in

[SMA/SMA.ts:14](https://github.com/bennycode/trading-signals/blob/95cb489/src/SMA/SMA.ts#L14)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Inherited from

MovingAverage.isStable

#### Defined in

[Indicator.ts:27](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L27)

## Methods

### getResult

▸ **getResult**(): `Big`

#### Returns

`Big`

#### Inherited from

[MovingAverage](MovingAverage.md).[getResult](MovingAverage.md#getresult)

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

[MovingAverage](MovingAverage.md).[update](MovingAverage.md#update)

#### Defined in

[SMA/SMA.ts:16](https://github.com/bennycode/trading-signals/blob/95cb489/src/SMA/SMA.ts#L16)

---

### getResultFromBatch

▸ `Static` **getResultFromBatch**(`prices`): `Big`

#### Parameters

| Name     | Type          |
| :------- | :------------ |
| `prices` | `BigSource`[] |

#### Returns

`Big`

#### Defined in

[SMA/SMA.ts:28](https://github.com/bennycode/trading-signals/blob/95cb489/src/SMA/SMA.ts#L28)
