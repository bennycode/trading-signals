[trading-signals](../README.md) / [Exports](../modules.md) / FasterDMA

# Class: FasterDMA

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`FasterDMAResult`](../interfaces/FasterDMAResult.md), `number`\>

## Table of contents

### Constructors

- [constructor](FasterDMA.md#constructor)

### Properties

- [long](FasterDMA.md#long)
- [short](FasterDMA.md#short)

### Accessors

- [isStable](FasterDMA.md#isstable)

### Methods

- [getResult](FasterDMA.md#getresult)
- [update](FasterDMA.md#update)

## Constructors

### constructor

• **new FasterDMA**(`short`, `long`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                                 | Default value |
| :------------------- | :------------------------------------------------------------------- | :------------ |
| `short`              | `number`                                                             | `undefined`   |
| `long`               | `number`                                                             | `undefined`   |
| `SmoothingIndicator` | [`FasterMovingAverageTypes`](../modules.md#fastermovingaveragetypes) | `FasterSMA`   |

#### Defined in

[DMA/DMA.ts:56](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L56)

## Properties

### long

• `Readonly` **long**: [`FasterMovingAverage`](FasterMovingAverage.md)

#### Defined in

[DMA/DMA.ts:54](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L54)

---

### short

• `Readonly` **short**: [`FasterMovingAverage`](FasterMovingAverage.md)

#### Defined in

[DMA/DMA.ts:53](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L53)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[DMA/DMA.ts:61](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L61)

## Methods

### getResult

▸ **getResult**(): [`FasterDMAResult`](../interfaces/FasterDMAResult.md)

#### Returns

[`FasterDMAResult`](../interfaces/FasterDMAResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[DMA/DMA.ts:70](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L70)

---

### update

▸ **update**(`price`): `void`

#### Parameters

| Name    | Type     |
| :------ | :------- |
| `price` | `number` |

#### Returns

`void`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[DMA/DMA.ts:65](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L65)
