[trading-signals](../README.md) / [Exports](../modules.md) / BigIndicatorSeries

# Class: BigIndicatorSeries<Input\>

## Type parameters

| Name    | Type        |
| :------ | :---------- |
| `Input` | `BigSource` |

## Hierarchy

- **`BigIndicatorSeries`**

  ↳ [`AC`](AC.md)

  ↳ [`ADX`](ADX.md)

  ↳ [`AO`](AO.md)

  ↳ [`ATR`](ATR.md)

  ↳ [`BollingerBandsWidth`](BollingerBandsWidth.md)

  ↳ [`CCI`](CCI.md)

  ↳ [`CG`](CG.md)

  ↳ [`DEMA`](DEMA.md)

  ↳ [`DX`](DX.md)

  ↳ [`MovingAverage`](MovingAverage.md)

  ↳ [`MAD`](MAD.md)

  ↳ [`MOM`](MOM.md)

  ↳ [`OBV`](OBV.md)

  ↳ [`ROC`](ROC.md)

  ↳ [`RSI`](RSI.md)

  ↳ [`StochasticRSI`](StochasticRSI.md)

  ↳ [`TR`](TR.md)

## Implements

- [`IndicatorSeries`](../interfaces/IndicatorSeries.md)<`Big`, `Input`\>

## Table of contents

### Constructors

- [constructor](BigIndicatorSeries.md#constructor)

### Properties

- [highest](BigIndicatorSeries.md#highest)
- [lowest](BigIndicatorSeries.md#lowest)

### Accessors

- [isStable](BigIndicatorSeries.md#isstable)

### Methods

- [getResult](BigIndicatorSeries.md#getresult)
- [update](BigIndicatorSeries.md#update)

## Constructors

### constructor

• **new BigIndicatorSeries**<`Input`\>()

#### Type parameters

| Name    | Type        |
| :------ | :---------- |
| `Input` | `BigSource` |

## Properties

### highest

• `Optional` **highest**: `Big`

Highest return value over the lifetime (not interval!) of the indicator.

#### Implementation of

[IndicatorSeries](../interfaces/IndicatorSeries.md).[highest](../interfaces/IndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L22)

---

### lowest

• `Optional` **lowest**: `Big`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Implementation of

[IndicatorSeries](../interfaces/IndicatorSeries.md).[lowest](../interfaces/IndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L24)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[IndicatorSeries](../interfaces/IndicatorSeries.md).[isStable](../interfaces/IndicatorSeries.md#isstable)

#### Defined in

[Indicator.ts:27](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L27)

## Methods

### getResult

▸ **getResult**(): `Big`

#### Returns

`Big`

#### Implementation of

[IndicatorSeries](../interfaces/IndicatorSeries.md).[getResult](../interfaces/IndicatorSeries.md#getresult)

#### Defined in

[Indicator.ts:31](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L31)

---

### update

▸ `Abstract` **update**(`input`): `void` \| `Big`

#### Parameters

| Name    | Type    |
| :------ | :------ |
| `input` | `Input` |

#### Returns

`void` \| `Big`

#### Implementation of

[IndicatorSeries](../interfaces/IndicatorSeries.md).[update](../interfaces/IndicatorSeries.md#update)

#### Defined in

[Indicator.ts:51](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L51)
