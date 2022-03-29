[trading-signals](../README.md) / [Exports](../modules.md) / FasterAC

# Class: FasterAC

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)<[`HighLowNumber`](../modules.md#highlownumber)\>

  ↳ **`FasterAC`**

## Table of contents

### Constructors

- [constructor](FasterAC.md#constructor)

### Properties

- [ao](FasterAC.md#ao)
- [highest](FasterAC.md#highest)
- [longAO](FasterAC.md#longao)
- [lowest](FasterAC.md#lowest)
- [momentum](FasterAC.md#momentum)
- [shortAO](FasterAC.md#shortao)
- [signal](FasterAC.md#signal)
- [signalInterval](FasterAC.md#signalinterval)

### Accessors

- [isStable](FasterAC.md#isstable)

### Methods

- [getResult](FasterAC.md#getresult)
- [update](FasterAC.md#update)

## Constructors

### constructor

• **new FasterAC**(`shortAO`, `longAO`, `signalInterval`)

#### Parameters

| Name             | Type     |
| :--------------- | :------- |
| `shortAO`        | `number` |
| `longAO`         | `number` |
| `signalInterval` | `number` |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[AC/AC.ts:50](https://github.com/bennycode/trading-signals/blob/95cb489/src/AC/AC.ts#L50)

## Properties

### ao

• `Readonly` **ao**: [`FasterAO`](FasterAO.md)

#### Defined in

[AC/AC.ts:46](https://github.com/bennycode/trading-signals/blob/95cb489/src/AC/AC.ts#L46)

---

### highest

• `Optional` **highest**: `number`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[highest](NumberIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:56](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L56)

---

### longAO

• `Readonly` **longAO**: `number`

---

### lowest

• `Optional` **lowest**: `number`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[lowest](NumberIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:58](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L58)

---

### momentum

• `Readonly` **momentum**: [`FasterMOM`](FasterMOM.md)

#### Defined in

[AC/AC.ts:47](https://github.com/bennycode/trading-signals/blob/95cb489/src/AC/AC.ts#L47)

---

### shortAO

• `Readonly` **shortAO**: `number`

---

### signal

• `Readonly` **signal**: [`FasterSMA`](FasterSMA.md)

#### Defined in

[AC/AC.ts:48](https://github.com/bennycode/trading-signals/blob/95cb489/src/AC/AC.ts#L48)

---

### signalInterval

• `Readonly` **signalInterval**: `number`

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Inherited from

NumberIndicatorSeries.isStable

#### Defined in

[Indicator.ts:61](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L61)

## Methods

### getResult

▸ **getResult**(): `number`

#### Returns

`number`

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[getResult](NumberIndicatorSeries.md#getresult)

#### Defined in

[Indicator.ts:65](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L65)

---

### update

▸ **update**(`input`): `number` \| `void`

#### Parameters

| Name    | Type                                           |
| :------ | :--------------------------------------------- |
| `input` | [`HighLowNumber`](../modules.md#highlownumber) |

#### Returns

`number` \| `void`

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[update](NumberIndicatorSeries.md#update)

#### Defined in

[AC/AC.ts:57](https://github.com/bennycode/trading-signals/blob/95cb489/src/AC/AC.ts#L57)
