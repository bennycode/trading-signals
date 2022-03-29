[trading-signals](../README.md) / [Exports](../modules.md) / Period

# Class: Period

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`PeriodResult`](../interfaces/PeriodResult.md)\>

## Table of contents

### Constructors

- [constructor](Period.md#constructor)

### Properties

- [highest](Period.md#highest)
- [interval](Period.md#interval)
- [lowest](Period.md#lowest)
- [values](Period.md#values)

### Accessors

- [isStable](Period.md#isstable)

### Methods

- [getResult](Period.md#getresult)
- [update](Period.md#update)

## Constructors

### constructor

• **new Period**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Defined in

[util/Period.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L24)

## Properties

### highest

• `Optional` **highest**: `Big`

Highest return value during the current period.

#### Defined in

[util/Period.ts:20](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L20)

---

### interval

• `Readonly` **interval**: `number`

---

### lowest

• `Optional` **lowest**: `Big`

Lowest return value during the current period.

#### Defined in

[util/Period.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L22)

---

### values

• **values**: `Big`[]

#### Defined in

[util/Period.ts:18](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L18)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[util/Period.ts:44](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L44)

## Methods

### getResult

▸ **getResult**(): [`PeriodResult`](../interfaces/PeriodResult.md)

#### Returns

[`PeriodResult`](../interfaces/PeriodResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[util/Period.ts:28](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L28)

---

### update

▸ **update**(`value`): `void` \| [`PeriodResult`](../interfaces/PeriodResult.md)

#### Parameters

| Name    | Type        |
| :------ | :---------- |
| `value` | `BigSource` |

#### Returns

`void` \| [`PeriodResult`](../interfaces/PeriodResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[util/Period.ts:35](https://github.com/bennycode/trading-signals/blob/95cb489/src/util/Period.ts#L35)
