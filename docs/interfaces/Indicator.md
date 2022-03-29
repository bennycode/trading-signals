[trading-signals](../README.md) / [Exports](../modules.md) / Indicator

# Interface: Indicator<Result, Input\>

## Type parameters

| Name     | Type        |
| :------- | :---------- |
| `Result` | `Big`       |
| `Input`  | `BigSource` |

## Hierarchy

- **`Indicator`**

  ↳ [`IndicatorSeries`](IndicatorSeries.md)

## Implemented by

- [`AccelerationBands`](../classes/AccelerationBands.md)
- [`BollingerBands`](../classes/BollingerBands.md)
- [`DMA`](../classes/DMA.md)
- [`FasterAccelerationBands`](../classes/FasterAccelerationBands.md)
- [`FasterBollingerBands`](../classes/FasterBollingerBands.md)
- [`FasterDMA`](../classes/FasterDMA.md)
- [`FasterMACD`](../classes/FasterMACD.md)
- [`FasterPeriod`](../classes/FasterPeriod.md)
- [`FasterStochasticOscillator`](../classes/FasterStochasticOscillator.md)
- [`MACD`](../classes/MACD.md)
- [`Period`](../classes/Period.md)
- [`StochasticOscillator`](../classes/StochasticOscillator.md)

## Table of contents

### Properties

- [isStable](Indicator.md#isstable)

### Methods

- [getResult](Indicator.md#getresult)
- [update](Indicator.md#update)

## Properties

### isStable

• **isStable**: `boolean`

#### Defined in

[Indicator.ts:7](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L7)

## Methods

### getResult

▸ **getResult**(): `Result`

#### Returns

`Result`

#### Defined in

[Indicator.ts:5](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L5)

---

### update

▸ **update**(`input`): `void` \| `Result`

#### Parameters

| Name    | Type    |
| :------ | :------ |
| `input` | `Input` |

#### Returns

`void` \| `Result`

#### Defined in

[Indicator.ts:9](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L9)
