[trading-signals](../README.md) / [Exports](../modules.md) / NumberIndicatorSeries

# Class: NumberIndicatorSeries<Input\>

## Type parameters

| Name    | Type     |
| :------ | :------- |
| `Input` | `number` |

## Hierarchy

- **`NumberIndicatorSeries`**

  ↳ [`FasterAC`](FasterAC.md)

  ↳ [`FasterADX`](FasterADX.md)

  ↳ [`FasterAO`](FasterAO.md)

  ↳ [`FasterATR`](FasterATR.md)

  ↳ [`FasterBollingerBandsWidth`](FasterBollingerBandsWidth.md)

  ↳ [`FasterCCI`](FasterCCI.md)

  ↳ [`FasterCG`](FasterCG.md)

  ↳ [`FasterDEMA`](FasterDEMA.md)

  ↳ [`FasterDX`](FasterDX.md)

  ↳ [`FasterMovingAverage`](FasterMovingAverage.md)

  ↳ [`FasterMAD`](FasterMAD.md)

  ↳ [`FasterMOM`](FasterMOM.md)

  ↳ [`FasterOBV`](FasterOBV.md)

  ↳ [`FasterROC`](FasterROC.md)

  ↳ [`FasterRSI`](FasterRSI.md)

  ↳ [`FasterStochasticRSI`](FasterStochasticRSI.md)

  ↳ [`FasterTR`](FasterTR.md)

  ↳ [`FasterWSMA`](FasterWSMA.md)

## Implements

- [`IndicatorSeries`](../interfaces/IndicatorSeries.md)<`number`, `Input`\>

## Table of contents

### Constructors

- [constructor](NumberIndicatorSeries.md#constructor)

### Properties

- [highest](NumberIndicatorSeries.md#highest)
- [lowest](NumberIndicatorSeries.md#lowest)

### Accessors

- [isStable](NumberIndicatorSeries.md#isstable)

### Methods

- [getResult](NumberIndicatorSeries.md#getresult)
- [update](NumberIndicatorSeries.md#update)

## Constructors

### constructor

• **new NumberIndicatorSeries**<`Input`\>()

#### Type parameters

| Name    | Type     |
| :------ | :------- |
| `Input` | `number` |

## Properties

### highest

• `Optional` **highest**: `number`

Highest return value over the lifetime (not interval!) of the indicator.

#### Implementation of

[IndicatorSeries](../interfaces/IndicatorSeries.md).[highest](../interfaces/IndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:56](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L56)

---

### lowest

• `Optional` **lowest**: `number`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Implementation of

[IndicatorSeries](../interfaces/IndicatorSeries.md).[lowest](../interfaces/IndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:58](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L58)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[IndicatorSeries](../interfaces/IndicatorSeries.md).[isStable](../interfaces/IndicatorSeries.md#isstable)

#### Defined in

[Indicator.ts:61](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L61)

## Methods

### getResult

▸ **getResult**(): `number`

#### Returns

`number`

#### Implementation of

[IndicatorSeries](../interfaces/IndicatorSeries.md).[getResult](../interfaces/IndicatorSeries.md#getresult)

#### Defined in

[Indicator.ts:65](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L65)

---

### update

▸ `Abstract` **update**(`input`): `number` \| `void`

#### Parameters

| Name    | Type    |
| :------ | :------ |
| `input` | `Input` |

#### Returns

`number` \| `void`

#### Implementation of

[IndicatorSeries](../interfaces/IndicatorSeries.md).[update](../interfaces/IndicatorSeries.md#update)

#### Defined in

[Indicator.ts:85](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L85)
