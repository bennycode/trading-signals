[trading-signals](README.md) / Exports

# trading-signals

## Table of contents

### Classes

- [AC](classes/AC.md)
- [ADX](classes/ADX.md)
- [AO](classes/AO.md)
- [ATR](classes/ATR.md)
- [AccelerationBands](classes/AccelerationBands.md)
- [BigIndicatorSeries](classes/BigIndicatorSeries.md)
- [BollingerBands](classes/BollingerBands.md)
- [BollingerBandsWidth](classes/BollingerBandsWidth.md)
- [CCI](classes/CCI.md)
- [CG](classes/CG.md)
- [DEMA](classes/DEMA.md)
- [DMA](classes/DMA.md)
- [DX](classes/DX.md)
- [EMA](classes/EMA.md)
- [FasterAC](classes/FasterAC.md)
- [FasterADX](classes/FasterADX.md)
- [FasterAO](classes/FasterAO.md)
- [FasterATR](classes/FasterATR.md)
- [FasterAccelerationBands](classes/FasterAccelerationBands.md)
- [FasterBollingerBands](classes/FasterBollingerBands.md)
- [FasterBollingerBandsWidth](classes/FasterBollingerBandsWidth.md)
- [FasterCCI](classes/FasterCCI.md)
- [FasterCG](classes/FasterCG.md)
- [FasterDEMA](classes/FasterDEMA.md)
- [FasterDMA](classes/FasterDMA.md)
- [FasterDX](classes/FasterDX.md)
- [FasterEMA](classes/FasterEMA.md)
- [FasterMACD](classes/FasterMACD.md)
- [FasterMAD](classes/FasterMAD.md)
- [FasterMOM](classes/FasterMOM.md)
- [FasterMovingAverage](classes/FasterMovingAverage.md)
- [FasterOBV](classes/FasterOBV.md)
- [FasterPeriod](classes/FasterPeriod.md)
- [FasterROC](classes/FasterROC.md)
- [FasterRSI](classes/FasterRSI.md)
- [FasterSMA](classes/FasterSMA.md)
- [FasterStochasticOscillator](classes/FasterStochasticOscillator.md)
- [FasterStochasticRSI](classes/FasterStochasticRSI.md)
- [FasterTR](classes/FasterTR.md)
- [FasterWSMA](classes/FasterWSMA.md)
- [MACD](classes/MACD.md)
- [MAD](classes/MAD.md)
- [MOM](classes/MOM.md)
- [MovingAverage](classes/MovingAverage.md)
- [NotEnoughDataError](classes/NotEnoughDataError.md)
- [NumberIndicatorSeries](classes/NumberIndicatorSeries.md)
- [OBV](classes/OBV.md)
- [Period](classes/Period.md)
- [ROC](classes/ROC.md)
- [RSI](classes/RSI.md)
- [SMA](classes/SMA.md)
- [StochasticOscillator](classes/StochasticOscillator.md)
- [StochasticRSI](classes/StochasticRSI.md)
- [TR](classes/TR.md)
- [WSMA](classes/WSMA.md)

### Interfaces

- [BandsResult](interfaces/BandsResult.md)
- [FasterBandsResult](interfaces/FasterBandsResult.md)
- [FasterDMAResult](interfaces/FasterDMAResult.md)
- [FasterPeriodResult](interfaces/FasterPeriodResult.md)
- [FasterStochasticResult](interfaces/FasterStochasticResult.md)
- [Indicator](interfaces/Indicator.md)
- [IndicatorSeries](interfaces/IndicatorSeries.md)
- [PeriodResult](interfaces/PeriodResult.md)
- [StochasticResult](interfaces/StochasticResult.md)

### Type aliases

- [DMAResult](modules.md#dmaresult)
- [FasterMACDResult](modules.md#fastermacdresult)
- [FasterMovingAverageTypes](modules.md#fastermovingaveragetypes)
- [HighLow](modules.md#highlow)
- [HighLowClose](modules.md#highlowclose)
- [HighLowCloseNumber](modules.md#highlowclosenumber)
- [HighLowNumber](modules.md#highlownumber)
- [MACDConfig](modules.md#macdconfig)
- [MACDResult](modules.md#macdresult)
- [MovingAverageTypes](modules.md#movingaveragetypes)
- [OpenHighLowClose](modules.md#openhighlowclose)
- [OpenHighLowCloseNumber](modules.md#openhighlowclosenumber)
- [OpenHighLowCloseVolume](modules.md#openhighlowclosevolume)
- [OpenHighLowCloseVolumeNumber](modules.md#openhighlowclosevolumenumber)

### Functions

- [getAverage](modules.md#getaverage)
- [getFasterAverage](modules.md#getfasteraverage)
- [getFasterStandardDeviation](modules.md#getfasterstandarddeviation)
- [getFixedArray](modules.md#getfixedarray)
- [getMaximum](modules.md#getmaximum)
- [getMinimum](modules.md#getminimum)
- [getStandardDeviation](modules.md#getstandarddeviation)

## Type aliases

### DMAResult

Ƭ **DMAResult**: `Object`

#### Type declaration

| Name    | Type  |
| :------ | :---- |
| `long`  | `Big` |
| `short` | `Big` |

#### Defined in

[DMA/DMA.ts:7](https://github.com/bennycode/trading-signals/blob/95cb489/src/DMA/DMA.ts#L7)

---

### FasterMACDResult

Ƭ **FasterMACDResult**: `Object`

#### Type declaration

| Name        | Type     |
| :---------- | :------- |
| `histogram` | `number` |
| `macd`      | `number` |
| `signal`    | `number` |

#### Defined in

[MACD/MACD.ts:19](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L19)

---

### FasterMovingAverageTypes

Ƭ **FasterMovingAverageTypes**: typeof [`FasterEMA`](classes/FasterEMA.md) \| typeof [`FasterSMA`](classes/FasterSMA.md) \| typeof [`FasterWSMA`](classes/FasterWSMA.md)

#### Defined in

[MA/MovingAverageTypes.ts:6](https://github.com/bennycode/trading-signals/blob/95cb489/src/MA/MovingAverageTypes.ts#L6)

---

### HighLow

Ƭ **HighLow**: `Object`

#### Type declaration

| Name   | Type        |
| :----- | :---------- |
| `high` | `BigSource` |
| `low`  | `BigSource` |

#### Defined in

[util/HighLowClose.ts:3](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/HighLowClose.ts#L3)

---

### HighLowClose

Ƭ **HighLowClose**: [`HighLow`](modules.md#highlow) & { `close`: `BigSource` }

#### Defined in

[util/HighLowClose.ts:5](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/HighLowClose.ts#L5)

---

### HighLowCloseNumber

Ƭ **HighLowCloseNumber**: [`HighLowNumber`](modules.md#highlownumber) & { `close`: `number` }

#### Defined in

[util/HighLowClose.ts:13](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/HighLowClose.ts#L13)

---

### HighLowNumber

Ƭ **HighLowNumber**: `Object`

#### Type declaration

| Name   | Type     |
| :----- | :------- |
| `high` | `number` |
| `low`  | `number` |

#### Defined in

[util/HighLowClose.ts:11](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/HighLowClose.ts#L11)

---

### MACDConfig

Ƭ **MACDConfig**: `Object`

#### Type declaration

| Name             | Type                                                               |
| :--------------- | :----------------------------------------------------------------- |
| `indicator`      | typeof [`EMA`](classes/EMA.md) \| typeof [`DEMA`](classes/DEMA.md) |
| `longInterval`   | `number`                                                           |
| `shortInterval`  | `number`                                                           |
| `signalInterval` | `number`                                                           |

#### Defined in

[MACD/MACD.ts:6](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L6)

---

### MACDResult

Ƭ **MACDResult**: `Object`

#### Type declaration

| Name        | Type  |
| :---------- | :---- |
| `histogram` | `Big` |
| `macd`      | `Big` |
| `signal`    | `Big` |

#### Defined in

[MACD/MACD.ts:13](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L13)

---

### MovingAverageTypes

Ƭ **MovingAverageTypes**: typeof [`EMA`](classes/EMA.md) \| typeof [`SMA`](classes/SMA.md) \| typeof [`WSMA`](classes/WSMA.md)

#### Defined in

[MA/MovingAverageTypes.ts:5](https://github.com/bennycode/trading-signals/blob/95cb489/src/MA/MovingAverageTypes.ts#L5)

---

### OpenHighLowClose

Ƭ **OpenHighLowClose**: [`HighLowClose`](modules.md#highlowclose) & { `open`: `BigSource` }

#### Defined in

[util/HighLowClose.ts:7](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/HighLowClose.ts#L7)

---

### OpenHighLowCloseNumber

Ƭ **OpenHighLowCloseNumber**: [`HighLowCloseNumber`](modules.md#highlowclosenumber) & { `open`: `number` }

#### Defined in

[util/HighLowClose.ts:15](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/HighLowClose.ts#L15)

---

### OpenHighLowCloseVolume

Ƭ **OpenHighLowCloseVolume**: [`OpenHighLowClose`](modules.md#openhighlowclose) & { `volume`: `BigSource` }

#### Defined in

[util/HighLowClose.ts:9](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/HighLowClose.ts#L9)

---

### OpenHighLowCloseVolumeNumber

Ƭ **OpenHighLowCloseVolumeNumber**: [`OpenHighLowCloseNumber`](modules.md#openhighlowclosenumber) & { `volume`: `number` }

#### Defined in

[util/HighLowClose.ts:17](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/HighLowClose.ts#L17)

## Functions

### getAverage

▸ **getAverage**(`values`): `Big`

Return the mean / average value.

#### Parameters

| Name     | Type          |
| :------- | :------------ |
| `values` | `BigSource`[] |

#### Returns

`Big`

#### Defined in

[util/getAverage.ts:6](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/getAverage.ts#L6)

---

### getFasterAverage

▸ **getFasterAverage**(`values`): `number`

#### Parameters

| Name     | Type       |
| :------- | :--------- |
| `values` | `number`[] |

#### Returns

`number`

#### Defined in

[util/getAverage.ts:14](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/getAverage.ts#L14)

---

### getFasterStandardDeviation

▸ **getFasterStandardDeviation**(`values`, `average?`): `number`

#### Parameters

| Name       | Type       |
| :--------- | :--------- |
| `values`   | `number`[] |
| `average?` | `number`   |

#### Returns

`number`

#### Defined in

[util/getStandardDeviation.ts:17](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/getStandardDeviation.ts#L17)

---

### getFixedArray

▸ **getFixedArray**<`T`\>(`length`): `T`[]

#### Type parameters

| Name |
| :--- |
| `T`  |

#### Parameters

| Name     | Type     |
| :------- | :------- |
| `length` | `number` |

#### Returns

`T`[]

#### Defined in

[util/getFixedArray.ts:1](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/getFixedArray.ts#L1)

---

### getMaximum

▸ **getMaximum**(`values`): `Big`

#### Parameters

| Name     | Type          |
| :------- | :------------ |
| `values` | `BigSource`[] |

#### Returns

`Big`

#### Defined in

[util/getMaximum.ts:3](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/getMaximum.ts#L3)

---

### getMinimum

▸ **getMinimum**(`values`): `Big`

#### Parameters

| Name     | Type          |
| :------- | :------------ |
| `values` | `BigSource`[] |

#### Returns

`Big`

#### Defined in

[util/getMinimum.ts:3](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/getMinimum.ts#L3)

---

### getStandardDeviation

▸ **getStandardDeviation**(`values`, `average?`): `Big`

Standard deviation calculates how prices for a collection of prices are spread out from the average price of these prices. Standard deviation makes outliers even more visible than mean absolute deviation (MAD).

**`see`** https://www.mathsisfun.com/data/standard-deviation-formulas.html

**`see`** https://www.youtube.com/watch?v=9-8E8L_77-8

#### Parameters

| Name       | Type          |
| :--------- | :------------ |
| `values`   | `BigSource`[] |
| `average?` | `BigSource`   |

#### Returns

`Big`

#### Defined in

[util/getStandardDeviation.ts:11](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/getStandardDeviation.ts#L11)
