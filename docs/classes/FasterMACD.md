[trading-signals](../README.md) / [Exports](../modules.md) / FasterMACD

# Class: FasterMACD

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`FasterMACDResult`](../modules.md#fastermacdresult)\>

## Table of contents

### Constructors

- [constructor](FasterMACD.md#constructor)

### Properties

- [long](FasterMACD.md#long)
- [prices](FasterMACD.md#prices)
- [short](FasterMACD.md#short)
- [signal](FasterMACD.md#signal)

### Accessors

- [isStable](FasterMACD.md#isstable)

### Methods

- [getResult](FasterMACD.md#getresult)
- [update](FasterMACD.md#update)

## Constructors

### constructor

• **new FasterMACD**(`short`, `long`, `signal`)

#### Parameters

| Name     | Type                                                         |
| :------- | :----------------------------------------------------------- |
| `short`  | [`FasterEMA`](FasterEMA.md) \| [`FasterDEMA`](FasterDEMA.md) |
| `long`   | [`FasterEMA`](FasterEMA.md) \| [`FasterDEMA`](FasterDEMA.md) |
| `signal` | [`FasterEMA`](FasterEMA.md) \| [`FasterDEMA`](FasterDEMA.md) |

#### Defined in

[MACD/MACD.ts:100](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L100)

## Properties

### long

• `Readonly` **long**: [`FasterEMA`](FasterEMA.md) \| [`FasterDEMA`](FasterDEMA.md)

---

### prices

• `Readonly` **prices**: `number`[] = `[]`

#### Defined in

[MACD/MACD.ts:97](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L97)

---

### short

• `Readonly` **short**: [`FasterEMA`](FasterEMA.md) \| [`FasterDEMA`](FasterDEMA.md)

---

### signal

• `Readonly` **signal**: [`FasterEMA`](FasterEMA.md) \| [`FasterDEMA`](FasterDEMA.md)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[MACD/MACD.ts:114](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L114)

## Methods

### getResult

▸ **getResult**(): [`FasterMACDResult`](../modules.md#fastermacdresult)

#### Returns

[`FasterMACDResult`](../modules.md#fastermacdresult)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[MACD/MACD.ts:106](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L106)

---

### update

▸ **update**(`price`): `void` \| [`FasterMACDResult`](../modules.md#fastermacdresult)

#### Parameters

| Name    | Type     |
| :------ | :------- |
| `price` | `number` |

#### Returns

`void` \| [`FasterMACDResult`](../modules.md#fastermacdresult)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[MACD/MACD.ts:118](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L118)
