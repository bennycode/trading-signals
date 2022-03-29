[trading-signals](../README.md) / [Exports](../modules.md) / AO

# Class: AO

Awesome Oscillator (AO) Type: Momentum

The Awesome Oscillator (AO) is an indicator used to measure market momentum. It has been developed by the technical analyst and charting enthusiast Bill Williams.

When AO crosses above Zero, short term momentum is rising faster than long term momentum which signals a bullish buying opportunity. When AO crosses below Zero, short term momentum is falling faster then the long term momentum which signals a bearish selling opportunity.

**`see`** https://www.tradingview.com/support/solutions/43000501826-awesome-oscillator-ao/

**`see`** https://tradingstrategyguides.com/bill-williams-awesome-oscillator-strategy/

## Hierarchy

- [`BigIndicatorSeries`](BigIndicatorSeries.md)<[`HighLow`](../modules.md#highlow)\>

  ↳ **`AO`**

## Table of contents

### Constructors

- [constructor](AO.md#constructor)

### Properties

- [highest](AO.md#highest)
- [long](AO.md#long)
- [longInterval](AO.md#longinterval)
- [lowest](AO.md#lowest)
- [short](AO.md#short)
- [shortInterval](AO.md#shortinterval)

### Accessors

- [isStable](AO.md#isstable)

### Methods

- [getResult](AO.md#getresult)
- [update](AO.md#update)

## Constructors

### constructor

• **new AO**(`shortInterval`, `longInterval`, `SmoothingIndicator?`)

#### Parameters

| Name                 | Type                                                     | Default value |
| :------------------- | :------------------------------------------------------- | :------------ |
| `shortInterval`      | `number`                                                 | `undefined`   |
| `longInterval`       | `number`                                                 | `undefined`   |
| `SmoothingIndicator` | [`MovingAverageTypes`](../modules.md#movingaveragetypes) | `SMA`         |

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[constructor](BigIndicatorSeries.md#constructor)

#### Defined in

[AO/AO.ts:26](https://github.com/bennycode/trading-signals/blob/95cb489/src/AO/AO.ts#L26)

## Properties

### highest

• `Optional` **highest**: `Big`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[highest](BigIndicatorSeries.md#highest)

#### Defined in

[Indicator.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L22)

---

### long

• `Readonly` **long**: [`MovingAverage`](MovingAverage.md)

#### Defined in

[AO/AO.ts:23](https://github.com/bennycode/trading-signals/blob/95cb489/src/AO/AO.ts#L23)

---

### longInterval

• `Readonly` **longInterval**: `number`

---

### lowest

• `Optional` **lowest**: `Big`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[BigIndicatorSeries](BigIndicatorSeries.md).[lowest](BigIndicatorSeries.md#lowest)

#### Defined in

[Indicator.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L24)

---

### short

• `Readonly` **short**: [`MovingAverage`](MovingAverage.md)

#### Defined in

[AO/AO.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/AO/AO.ts#L24)

---

### shortInterval

• `Readonly` **shortInterval**: `number`

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

▸ **update**(`__namedParameters`): `void` \| `Big`

#### Parameters

| Name                | Type                               |
| :------------------ | :--------------------------------- |
| `__namedParameters` | [`HighLow`](../modules.md#highlow) |

#### Returns

`void` \| `Big`

#### Overrides

[BigIndicatorSeries](BigIndicatorSeries.md).[update](BigIndicatorSeries.md#update)

#### Defined in

[AO/AO.ts:36](https://github.com/bennycode/trading-signals/blob/95cb489/src/AO/AO.ts#L36)
