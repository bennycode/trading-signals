[trading-signals](../README.md) / [Exports](../modules.md) / DMA

# Class: DMA

Dual Moving Average (DMA) Type: Trend

The DMA consists of two moving averages: Short-term & long-term.

Dual Moving Average Crossover: A short-term MA crossing above a long-term MA indicates a bullish buying opportunity. A short-term MA crossing below a long-term MA indicates a bearish selling opportunity.

**`see`** https://faculty.fuqua.duke.edu/~charvey/Teaching/BA453_2002/CCAM/CCAM.htm#_Toc2634228

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`DMAResult`](../modules.md#dmaresult)\>

## Table of contents

### Constructors

- [constructor](DMA.md#constructor)

### Properties

- [long](DMA.md#long)
- [short](DMA.md#short)

### Accessors

- [isStable](DMA.md#isstable)

### Methods

- [getResult](DMA.md#getresult)
- [update](DMA.md#update)

## Constructors

### constructor

• **new DMA**(`short`, `long`, `Indicator?`)

#### Parameters

| Name        | Type                                                     | Default value |
| :---------- | :------------------------------------------------------- | :------------ |
| `short`     | `number`                                                 | `undefined`   |
| `long`      | `number`                                                 | `undefined`   |
| `Indicator` | [`MovingAverageTypes`](../modules.md#movingaveragetypes) | `SMA`         |

#### Defined in

[DMA/DMA.ts:30](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L30)

## Properties

### long

• `Readonly` **long**: [`MovingAverage`](MovingAverage.md)

#### Defined in

[DMA/DMA.ts:28](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L28)

---

### short

• `Readonly` **short**: [`MovingAverage`](MovingAverage.md)

#### Defined in

[DMA/DMA.ts:27](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L27)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[DMA/DMA.ts:35](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L35)

## Methods

### getResult

▸ **getResult**(): [`DMAResult`](../modules.md#dmaresult)

#### Returns

[`DMAResult`](../modules.md#dmaresult)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[DMA/DMA.ts:44](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L44)

---

### update

▸ **update**(`price`): `void`

#### Parameters

| Name    | Type        |
| :------ | :---------- |
| `price` | `BigSource` |

#### Returns

`void`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[DMA/DMA.ts:39](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L39)
