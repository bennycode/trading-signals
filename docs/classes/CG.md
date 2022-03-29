[trading-signals](../README.md) / [Exports](../modules.md) / CG

# Class: CG

Center of Gravity (CG) Type: Trend

Implementation of the Center of Gravity (CG) oscillator by John Ehlers.

**`note`** According to the specification, the price inputs shall be calculated the following way: ((High Price + Low Price) / 2)

**`note`** The selected interval should be half the dominant cycle length (signal line)

**`note`** If the interval gets too short, the CG oscillator loses its smoothing and gets a little too nervous for profitable trading

**`see`** http://www.mesasoftware.com/papers/TheCGOscillator.pdf

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)

  ↳ **`CG`**

## Table of contents

### Constructors

- [constructor](CG.md#constructor)

### Properties

- [highest](CG.md#highest)
- [interval](CG.md#interval)
- [lowest](CG.md#lowest)
- [prices](CG.md#prices)
- [signal](CG.md#signal)
- [signalInterval](CG.md#signalinterval)

### Accessors

- [isStable](CG.md#isstable)

### Methods

- [getResult](CG.md#getresult)
- [update](CG.md#update)

## Constructors

### constructor

• **new CG**(`interval`, `signalInterval`)

#### Parameters

| Name             | Type     |
| :--------------- | :------- |
| `interval`       | `number` |
| `signalInterval` | `number` |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[CG/CG.ts:27](https://github.com/bennycode/trading-signals/blob/95cb489/src/CG/CG.ts#L27)

## Properties

### highest

• `Optional` **highest**: `Big`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[highest](BigIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L22)

---

### interval

• `Readonly` **interval**: `number`

---

### lowest

• `Optional` **lowest**: `Big`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[lowest](BigIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L24)

---

### prices

• `Readonly` **prices**: `Big`[] = `[]`

#### Defined in

[CG/CG.ts:21](https://github.com/bennycode/trading-signals/blob/95cb489/src/CG/CG.ts#L21)

---

### signal

• **signal**: [`SMA`](SMA.md)

#### Defined in

[CG/CG.ts:19](https://github.com/bennycode/trading-signals/blob/95cb489/src/CG/CG.ts#L19)

---

### signalInterval

• `Readonly` **signalInterval**: `number`

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Overrides

BigIndicatorSeries.isStable

#### Defined in

[CG/CG.ts:23](https://github.com/bennycode/trading-signals/blob/95cb489/src/CG/CG.ts#L23)

## Methods

### getResult

▸ **getResult**(): `Big`

#### Returns

`Big`

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[getResult](BigIndicatorSeries.md#getresult)

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

[BigIndicatorSeries](BigIndicatorSeries.md).[update](BigIndicatorSeries.md#update)

#### Defined in

[CG/CG.ts:32](https://github.com/bennycode/trading-signals/blob/95cb489/src/CG/CG.ts#L32)
