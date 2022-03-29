[trading-signals](../README.md) / [Exports](../modules.md) / FasterBollingerBands

# Class: FasterBollingerBands

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`FasterBandsResult`](../interfaces/FasterBandsResult.md)\>

## Table of contents

### Constructors

- [constructor](FasterBollingerBands.md#constructor)

### Properties

- [deviationMultiplier](FasterBollingerBands.md#deviationmultiplier)
- [interval](FasterBollingerBands.md#interval)
- [prices](FasterBollingerBands.md#prices)

### Accessors

- [isStable](FasterBollingerBands.md#isstable)

### Methods

- [getResult](FasterBollingerBands.md#getresult)
- [update](FasterBollingerBands.md#update)

## Constructors

### constructor

• **new FasterBollingerBands**(`interval`, `deviationMultiplier?`)

#### Parameters

| Name                  | Type     | Default value |
| :-------------------- | :------- | :------------ |
| `interval`            | `number` | `undefined`   |
| `deviationMultiplier` | `number` | `2`           |

#### Defined in

[BBANDS/BollingerBands.ts:68](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBANDS/BollingerBands.ts#L68)

## Properties

### deviationMultiplier

• `Readonly` **deviationMultiplier**: `number` = `2`

---

### interval

• `Readonly` **interval**: `number`

---

### prices

• `Readonly` **prices**: `number`[] = `[]`

#### Defined in

[BBANDS/BollingerBands.ts:65](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBANDS/BollingerBands.ts#L65)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[BBANDS/BollingerBands.ts:95](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBANDS/BollingerBands.ts#L95)

## Methods

### getResult

▸ **getResult**(): [`FasterBandsResult`](../interfaces/FasterBandsResult.md)

#### Returns

[`FasterBandsResult`](../interfaces/FasterBandsResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[BBANDS/BollingerBands.ts:87](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBANDS/BollingerBands.ts#L87)

---

### update

▸ **update**(`price`): `void` \| [`FasterBandsResult`](../interfaces/FasterBandsResult.md)

#### Parameters

| Name    | Type     |
| :------ | :------- |
| `price` | `number` |

#### Returns

`void` \| [`FasterBandsResult`](../interfaces/FasterBandsResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[BBANDS/BollingerBands.ts:70](https://github.com/bennycode/trading-signals/blob/95cb489/src/BBANDS/BollingerBands.ts#L70)
