[trading-signals](../README.md) / [Exports](../modules.md) / MOM

# Class: MOM

Momentum Indicator (MOM / MTM) Type: Momentum

The Momentum indicator returns the change between the current price and the price n times ago.

**`see`** https://en.wikipedia.org/wiki/Momentum_(technical_analysis)

**`see`** https://www.warriortrading.com/momentum-indicator/

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)

  ↳ **`MOM`**

## Table of contents

### Constructors

- [constructor](MOM.md#constructor)

### Properties

- [highest](MOM.md#highest)
- [interval](MOM.md#interval)
- [lowest](MOM.md#lowest)

### Accessors

- [isStable](MOM.md#isstable)

### Methods

- [getResult](MOM.md#getresult)
- [update](MOM.md#update)

## Constructors

### constructor

• **new MOM**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[MOM/MOM.ts:18](https://github.com/bennycode/trading-signals/blob/95cb489/src/MOM/MOM.ts#L18)

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

▸ **update**(`value`): `void` \| `Big`

#### Parameters

| Name    | Type        |
| :------ | :---------- |
| `value` | `BigSource` |

#### Returns

`void` \| `Big`

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[update](BigIndicatorSeries.md#update)

#### Defined in

[MOM/MOM.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/MOM/MOM.ts#L24)
