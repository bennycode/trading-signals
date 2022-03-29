[trading-signals](../README.md) / [Exports](../modules.md) / AC

# Class: AC

Accelerator Oscillator (AC) Type: Momentum

The Accelerator Oscillator (AC) is an indicator used to detect when a momentum changes. It has been developed by Bill Williams. If the momentum in an uptrend is starting to slow down, that could suggest that there is less interest in the asset. This typically leads to selling. In the inverse, momentum to the downside will start to slow down before buy orders come in. The Accelerator Oscillator also looks at whether there is an acceleration in the change of momentum.

**`see`** https://www.thinkmarkets.com/en/indicators/bill-williams-accelerator/

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)<[`HighLow`](../modules.md#highlow)\>

  ↳ **`AC`**

## Table of contents

### Constructors

- [constructor](AC.md#constructor)

### Properties

- [ao](AC.md#ao)
- [highest](AC.md#highest)
- [longAO](AC.md#longao)
- [lowest](AC.md#lowest)
- [momentum](AC.md#momentum)
- [shortAO](AC.md#shortao)
- [signal](AC.md#signal)
- [signalInterval](AC.md#signalinterval)

### Accessors

- [isStable](AC.md#isstable)

### Methods

- [getResult](AC.md#getresult)
- [update](AC.md#update)

## Constructors

### constructor

• **new AC**(`shortAO`, `longAO`, `signalInterval`)

#### Parameters

| Name             | Type     |
| :--------------- | :------- |
| `shortAO`        | `number` |
| `longAO`         | `number` |
| `signalInterval` | `number` |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[AC/AC.ts:25](https://github.com/bennycode/trading-signals/blob/95cb489/src/AC/AC.ts#L25)

## Properties

### ao

• `Readonly` **ao**: [`AO`](AO.md)

#### Defined in

[AC/AC.ts:21](https://github.com/bennycode/trading-signals/blob/95cb489/src/AC/AC.ts#L21)

---

### highest

• `Optional` **highest**: `Big`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[highest](BigIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L22)

---

### longAO

• `Readonly` **longAO**: `number`

---

### lowest

• `Optional` **lowest**: `Big`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[lowest](BigIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L24)

---

### momentum

• `Readonly` **momentum**: [`MOM`](MOM.md)

#### Defined in

[AC/AC.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/AC/AC.ts#L22)

---

### shortAO

• `Readonly` **shortAO**: `number`

---

### signal

• `Readonly` **signal**: [`SMA`](SMA.md)

#### Defined in

[AC/AC.ts:23](https://github.com/bennycode/trading-signals/blob/95cb489/src/AC/AC.ts#L23)

---

### signalInterval

• `Readonly` **signalInterval**: `number`

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Inherited from

BigIndicatorSeries.isStable

#### Defined in

[Indicator.ts:27](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L27)

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

▸ **update**(`input`): `void` \| `Big`

#### Parameters

| Name    | Type                               |
| :------ | :--------------------------------- |
| `input` | [`HighLow`](../modules.md#highlow) |

#### Returns

`void` \| `Big`

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[update](BigIndicatorSeries.md#update)

#### Defined in

[AC/AC.ts:32](https://github.com/bennycode/trading-signals/blob/95cb489/src/AC/AC.ts#L32)
