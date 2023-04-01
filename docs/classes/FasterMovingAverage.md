[trading-signals](../README.md) / [Exports](../modules.md) / FasterMovingAverage

# Class: FasterMovingAverage

Tracks results of an indicator over time and memorizes the highest & lowest result.

## Hierarchy

- [`NumberIndicatorSeries`](NumberIndicatorSeries.md)

  ↳ **`FasterMovingAverage`**

  ↳↳ [`FasterEMA`](FasterEMA.md)

  ↳↳ [`FasterSMA`](FasterSMA.md)

## Table of contents

### Constructors

- [constructor](FasterMovingAverage.md#constructor)

### Properties

- [highest](FasterMovingAverage.md#highest)
- [interval](FasterMovingAverage.md#interval)
- [lowest](FasterMovingAverage.md#lowest)

### Accessors

- [isStable](FasterMovingAverage.md#isstable)

### Methods

- [getResult](FasterMovingAverage.md#getresult)
- [update](FasterMovingAverage.md#update)
- [updates](FasterMovingAverage.md#updates)

## Constructors

### constructor

• **new FasterMovingAverage**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[constructor](NumberIndicatorSeries.md#constructor)

#### Defined in

[MA/MovingAverage.ts:26](https://github.com/bennycode/trading-signals/blob/53d8192/src/MA/MovingAverage.ts#L26)

## Properties

### highest

• `Optional` **highest**: `number`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[highest](NumberIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:56](https://github.com/bennycode/trading-signals/blob/53d8192/src/Indicator.ts#L56)

---

### interval

• `Readonly` **interval**: `number`

#### Defined in

[MA/MovingAverage.ts:26](https://github.com/bennycode/trading-signals/blob/53d8192/src/MA/MovingAverage.ts#L26)

---

### lowest

• `Optional` **lowest**: `number`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[lowest](NumberIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:58](https://github.com/bennycode/trading-signals/blob/53d8192/src/Indicator.ts#L58)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Inherited from

NumberIndicatorSeries.isStable

#### Defined in

[Indicator.ts:61](https://github.com/bennycode/trading-signals/blob/53d8192/src/Indicator.ts#L61)

## Methods

### getResult

▸ **getResult**(): `number`

#### Returns

`number`

#### Inherited from

[NumberIndicatorSeries](NumberIndicatorSeries.md).[getResult](NumberIndicatorSeries.md#getresult)

#### Defined in

[Indicator.ts:65](https://github.com/bennycode/trading-signals/blob/53d8192/src/Indicator.ts#L65)

---

### update

▸ `Abstract` **update**(`price`): `number` \| `void`

#### Parameters

| Name    | Type     |
| :------ | :------- |
| `price` | `number` |

#### Returns

`number` \| `void`

#### Overrides

[NumberIndicatorSeries](NumberIndicatorSeries.md).[update](NumberIndicatorSeries.md#update)

#### Defined in

[MA/MovingAverage.ts:35](https://github.com/bennycode/trading-signals/blob/53d8192/src/MA/MovingAverage.ts#L35)

---

### updates

▸ **updates**(`prices`): `number` \| `void`

#### Parameters

| Name     | Type       |
| :------- | :--------- |
| `prices` | `number`[] |

#### Returns

`number` \| `void`

#### Defined in

[MA/MovingAverage.ts:30](https://github.com/bennycode/trading-signals/blob/53d8192/src/MA/MovingAverage.ts#L30)
