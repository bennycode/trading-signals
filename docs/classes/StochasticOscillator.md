[trading-signals](../README.md) / [Exports](../modules.md) / StochasticOscillator

# Class: StochasticOscillator

Stochastic Oscillator (STOCH) Type: Momentum

The Stochastic Oscillator was developed by George Lane and is range-bound between 0 and 100. The Stochastic Oscillator attempts to predict price turning points. A value of 80 indicates that the asset is on the verge of being overbought. By default, a Simple Moving Average (SMA) is used. When the momentum starts to slow down, the Stochastic Oscillator values start to turn down. In the case of an uptrend, prices tend to make higher highs, and the settlement price usually tends to be in the upper end of that time period's trading range.

The stochastic k (%k) values represent the relation between current close to the period's price range (high/low). It is sometimes referred as the "fast" stochastic period (fastk). The stochastic d (%d) values represent a Moving Average of the %k values. It is sometimes referred as the "slow" period.

**`see`** https://en.wikipedia.org/wiki/Stochastic_oscillator

**`see`** https://www.investopedia.com/terms/s/stochasticoscillator.asp

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`StochasticResult`](../interfaces/StochasticResult.md), [`HighLowClose`](../modules.md#highlowclose)\>

## Table of contents

### Constructors

- [constructor](StochasticOscillator.md#constructor)

### Properties

- [m](StochasticOscillator.md#m)
- [n](StochasticOscillator.md#n)
- [p](StochasticOscillator.md#p)

### Accessors

- [isStable](StochasticOscillator.md#isstable)

### Methods

- [getResult](StochasticOscillator.md#getresult)
- [update](StochasticOscillator.md#update)

## Constructors

### constructor

• **new StochasticOscillator**(`n`, `m`, `p`)

Constructs a Stochastic Oscillator.

#### Parameters

| Name | Type     | Description           |
| :--- | :------- | :-------------------- |
| `n`  | `number` | The %k period         |
| `m`  | `number` | The %k slowing period |
| `p`  | `number` | The %d period         |

#### Defined in

[STOCH/StochasticOscillator.ts:54](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticOscillator.ts#L54)

## Properties

### m

• `Readonly` **m**: `number`

---

### n

• `Readonly` **n**: `number`

---

### p

• `Readonly` **p**: `number`

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[STOCH/StochasticOscillator.ts:92](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticOscillator.ts#L92)

## Methods

### getResult

▸ **getResult**(): [`StochasticResult`](../interfaces/StochasticResult.md)

#### Returns

[`StochasticResult`](../interfaces/StochasticResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[STOCH/StochasticOscillator.ts:59](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticOscillator.ts#L59)

---

### update

▸ **update**(`candle`): `void` \| [`StochasticResult`](../interfaces/StochasticResult.md)

#### Parameters

| Name     | Type                                         |
| :------- | :------------------------------------------- |
| `candle` | [`HighLowClose`](../modules.md#highlowclose) |

#### Returns

`void` \| [`StochasticResult`](../interfaces/StochasticResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[STOCH/StochasticOscillator.ts:67](https://github.com/bennycode/trading-signals/blob/95cb489/src/STOCH/StochasticOscillator.ts#L67)
