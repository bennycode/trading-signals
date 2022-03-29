[trading-signals](../README.md) / [Exports](../modules.md) / FasterRSI

# Class: FasterRSI

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)

  ↳ **`FasterRSI`**

## Table of contents

### Constructors

- [constructor](FasterRSI.md#constructor)

### Properties

- [highest](FasterRSI.md#highest)
- [interval](FasterRSI.md#interval)
- [lowest](FasterRSI.md#lowest)

### Accessors

- [isStable](FasterRSI.md#isstable)

### Methods

- [getResult](FasterRSI.md#getresult)
- [update](FasterRSI.md#update)

## Constructors

### constructor

• **new FasterRSI**(`interval`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                                 | Default value |
| :------------------- | :------------------------------------------------------------------- | :------------ |
| `interval`           | `number`                                                             | `undefined`   |
| `SmoothingIndicator` | [`FasterMovingAverageTypes`](../modules.md#fastermovingaveragetypes) | `FasterWSMA`  |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[RSI/RSI.ts:75](https://github.com/bennycode/trading-signals/blob/95cb489/src/RSI/RSI.ts#L75)

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

[RSI/RSI.ts:81](https://github.com/bennycode/trading-signals/blob/95cb489/src/RSI/RSI.ts#L81)
