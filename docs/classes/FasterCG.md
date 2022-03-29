[trading-signals](../README.md) / [Exports](../modules.md) / FasterCG

# Class: FasterCG

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)

  ↳ **`FasterCG`**

## Table of contents

### Constructors

- [constructor](FasterCG.md#constructor)

### Properties

- [highest](FasterCG.md#highest)
- [interval](FasterCG.md#interval)
- [lowest](FasterCG.md#lowest)
- [prices](FasterCG.md#prices)
- [signal](FasterCG.md#signal)
- [signalInterval](FasterCG.md#signalinterval)

### Accessors

- [isStable](FasterCG.md#isstable)

### Methods

- [getResult](FasterCG.md#getresult)
- [update](FasterCG.md#update)

## Constructors

### constructor

• **new FasterCG**(`interval`, `signalInterval`)

#### Parameters

| Name             | Type     |
| :--------------- | :------- |
| `interval`       | `number` |
| `signalInterval` | `number` |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[CG/CG.ts:67](https://github.com/bennycode/trading-signals/blob/95cb489/src/CG/CG.ts#L67)

## Properties

### highest

• `Optional` **highest**: `number`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[highest](NumberIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:56](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L56)

---

### interval

• `Readonly` **interval**: `number`

---

### lowest

• `Optional` **lowest**: `number`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[lowest](NumberIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:58](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L58)

---

### prices

• `Readonly` **prices**: `number`[] = `[]`

#### Defined in

[CG/CG.ts:61](https://github.com/bennycode/trading-signals/blob/95cb489/src/CG/CG.ts#L61)

---

### signal

• **signal**: [`FasterSMA`](FasterSMA.md)

#### Defined in

[CG/CG.ts:59](https://github.com/bennycode/trading-signals/blob/95cb489/src/CG/CG.ts#L59)

---

### signalInterval

• `Readonly` **signalInterval**: `number`

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Overrides

NumberIndicatorSeries.isStable

#### Defined in

[CG/CG.ts:63](https://github.com/bennycode/trading-signals/blob/95cb489/src/CG/CG.ts#L63)

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

▸ **update**(`price`): `number` \| `void`

#### Parameters

| Name    | Type     |
| :------ | :------- |
| `price` | `number` |

#### Returns

`number` \| `void`

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[update](NumberIndicatorSeries.md#update)

#### Defined in

[CG/CG.ts:72](https://github.com/bennycode/trading-signals/blob/95cb489/src/CG/CG.ts#L72)
