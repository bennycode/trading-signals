[trading-signals](../README.md) / [Exports](../modules.md) / FasterStochasticOscillator

# Class: FasterStochasticOscillator

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`FasterStochasticResult`](../interfaces/FasterStochasticResult.md), [`HighLowCloseNumber`](../modules.md#highlowclosenumber)\>

## Table of contents

### Constructors

- [constructor](FasterStochasticOscillator.md#constructor)

### Properties

- [candles](FasterStochasticOscillator.md#candles)
- [m](FasterStochasticOscillator.md#m)
- [n](FasterStochasticOscillator.md#n)
- [p](FasterStochasticOscillator.md#p)

### Accessors

- [isStable](FasterStochasticOscillator.md#isstable)

### Methods

- [getResult](FasterStochasticOscillator.md#getresult)
- [update](FasterStochasticOscillator.md#update)

## Constructors

### constructor

• **new FasterStochasticOscillator**(`n`, `m`, `p`)

#### Parameters

| Name | Type     | Description           |
| :--- | :------- | :-------------------- |
| `n`  | `number` | The %k period         |
| `m`  | `number` | The %k slowing period |
| `p`  | `number` | The %d period         |

#### Defined in

[STOCH/StochasticOscillator.ts:108](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticOscillator.ts#L108)

## Properties

### candles

• `Readonly` **candles**: [`HighLowCloseNumber`](../modules.md#highlowclosenumber)[] = `[]`

#### Defined in

[STOCH/StochasticOscillator.ts:98](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticOscillator.ts#L98)

---

### m

• **m**: `number`

---

### n

• **n**: `number`

---

### p

• **p**: `number`

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[STOCH/StochasticOscillator.ts:121](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticOscillator.ts#L121)

## Methods

### getResult

▸ **getResult**(): [`FasterStochasticResult`](../interfaces/FasterStochasticResult.md)

#### Returns

[`FasterStochasticResult`](../interfaces/FasterStochasticResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[STOCH/StochasticOscillator.ts:113](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticOscillator.ts#L113)

---

### update

▸ **update**(`candle`): `void` \| [`FasterStochasticResult`](../interfaces/FasterStochasticResult.md)

#### Parameters

| Name     | Type                                                     |
| :------- | :------------------------------------------------------- |
| `candle` | [`HighLowCloseNumber`](../modules.md#highlowclosenumber) |

#### Returns

`void` \| [`FasterStochasticResult`](../interfaces/FasterStochasticResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[STOCH/StochasticOscillator.ts:125](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticOscillator.ts#L125)
