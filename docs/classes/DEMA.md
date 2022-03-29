[trading-signals](../README.md) / [Exports](../modules.md) / DEMA

# Class: DEMA

Double Exponential Moving Average (DEMA) Type: Trend

The Double Exponential Moving Average (DEMA) was developed by Patrick G. Mulloy. It attempts to remove the lag associated with Moving Averages by placing more weight on recent values. It has its name because the value of an EMA is doubled which makes it responds more quickly to short-term price changes than a normal EMA.

**`see`** https://www.investopedia.com/terms/d/double-exponential-moving-average.asp

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)

  ↳ **`DEMA`**

## Table of contents

### Constructors

- [constructor](DEMA.md#constructor)

### Properties

- [highest](DEMA.md#highest)
- [interval](DEMA.md#interval)
- [lowest](DEMA.md#lowest)

### Accessors

- [isStable](DEMA.md#isstable)

### Methods

- [getResult](DEMA.md#getresult)
- [update](DEMA.md#update)

## Constructors

### constructor

• **new DEMA**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[DEMA/DEMA.ts:19](https://github.com/bennycode/trading-signals/blob/95cb489/src/DEMA/DEMA.ts#L19)

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

#### Overrides

BigIndicatorSeries.isStable

#### Defined in

[DEMA/DEMA.ts:31](https://github.com/bennycode/trading-signals/blob/95cb489/src/DEMA/DEMA.ts#L31)

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

▸ **update**(`price`): `Big`

#### Parameters

| Name    | Type        |
| :------ | :---------- |
| `price` | `BigSource` |

#### Returns

`Big`

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[update](BigIndicatorSeries.md#update)

#### Defined in

[DEMA/DEMA.ts:25](https://github.com/bennycode/trading-signals/blob/95cb489/src/DEMA/DEMA.ts#L25)
