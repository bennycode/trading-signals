[trading-signals](../README.md) / [Exports](../modules.md) / FasterPeriod

# Class: FasterPeriod

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`FasterPeriodResult`](../interfaces/FasterPeriodResult.md)\>

## Table of contents

### Constructors

- [constructor](FasterPeriod.md#constructor)

### Properties

- [highest](FasterPeriod.md#highest)
- [interval](FasterPeriod.md#interval)
- [lowest](FasterPeriod.md#lowest)
- [values](FasterPeriod.md#values)

### Accessors

- [isStable](FasterPeriod.md#isstable)

### Methods

- [getResult](FasterPeriod.md#getresult)
- [update](FasterPeriod.md#update)

## Constructors

### constructor

• **new FasterPeriod**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Defined in

[util/Period.ts:56](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L56)

## Properties

### highest

• `Optional` **highest**: `number`

Highest return value during the current period.

#### Defined in

[util/Period.ts:52](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L52)

---

### interval

• `Readonly` **interval**: `number`

---

### lowest

• `Optional` **lowest**: `number`

Lowest return value during the current period.

#### Defined in

[util/Period.ts:54](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L54)

---

### values

• **values**: `number`[]

#### Defined in

[util/Period.ts:50](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L50)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[util/Period.ts:76](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L76)

## Methods

### getResult

▸ **getResult**(): [`FasterPeriodResult`](../interfaces/FasterPeriodResult.md)

#### Returns

[`FasterPeriodResult`](../interfaces/FasterPeriodResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[util/Period.ts:60](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L60)

---

### update

▸ **update**(`value`): `void` \| [`FasterPeriodResult`](../interfaces/FasterPeriodResult.md)

#### Parameters

| Name    | Type     |
| :------ | :------- |
| `value` | `number` |

#### Returns

`void` \| [`FasterPeriodResult`](../interfaces/FasterPeriodResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[util/Period.ts:67](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L67)
