[trading-signals](../README.md) / [Exports](../modules.md) / AccelerationBands

# Class: AccelerationBands

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`BandsResult`](../interfaces/BandsResult.md), [`HighLowClose`](../modules.md#highlowclose)\>

## Table of contents

### Constructors

- [constructor](AccelerationBands.md#constructor)

### Properties

- [interval](AccelerationBands.md#interval)
- [width](AccelerationBands.md#width)

### Accessors

- [isStable](AccelerationBands.md#isstable)

### Methods

- [getResult](AccelerationBands.md#getresult)
- [update](AccelerationBands.md#update)

## Constructors

### constructor

• **new AccelerationBands**(`interval`, `width`, `SmoothingIndicator?`)

Acceleration Bands (ABANDS) Type: Volatility

Acceleration bands created by Price Headley are set as an envelope around a moving average. The upper and lower bands are of equal distance from the middle band.

Two consecutive closes outside Acceleration Bands suggest an entry point in the direction of the breakout (either bullish or bearish). A long position is usually kept till the first close back inside the bands.

**`see`** https://www.tradingtechnologies.com/xtrader-help/x-study/technical-indicator-definitions/acceleration-bands-abands/

**`see`** https://www.motivewave.com/studies/acceleration_bands.htm

**`see`** https://github.com/QuantConnect/Lean/blob/master/Indicators/AccelerationBands.cs

**`see`** https://github.com/twopirllc/pandas-ta/blob/master/pandas_ta/volatility/accbands.py

#### Parameters

| Name | Type | Default value | Description |
| :-- | :-- | :-- | :-- |
| `interval` | `number` | `undefined` | The interval that is being used for the three moving averages which create lower, middle and upper bands |
| `width` | `number` | `undefined` | A coefficient specifying the distance between the middle band and upper/lower bands |
| `SmoothingIndicator` | [`MovingAverageTypes`](../modules.md#movingaveragetypes) | `SMA` | Which moving average (SMA, EMA, ...) to use |

#### Defined in

[ABANDS/AccelerationBands.ts:35](https://github.com/bennycode/trading-signals/blob/95cb489/src/ABANDS/AccelerationBands.ts#L35)

## Properties

### interval

• `Readonly` **interval**: `number`

---

### width

• `Readonly` **width**: `number`

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[ABANDS/AccelerationBands.ts:45](https://github.com/bennycode/trading-signals/blob/95cb489/src/ABANDS/AccelerationBands.ts#L45)

## Methods

### getResult

▸ **getResult**(): [`BandsResult`](../interfaces/BandsResult.md)

#### Returns

[`BandsResult`](../interfaces/BandsResult.md)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[ABANDS/AccelerationBands.ts:61](https://github.com/bennycode/trading-signals/blob/95cb489/src/ABANDS/AccelerationBands.ts#L61)

---

### update

▸ **update**(`__namedParameters`): `void`

#### Parameters

| Name                | Type                                         |
| :------------------ | :------------------------------------------- |
| `__namedParameters` | [`HighLowClose`](../modules.md#highlowclose) |

#### Returns

`void`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[ABANDS/AccelerationBands.ts:49](https://github.com/bennycode/trading-signals/blob/95cb489/src/ABANDS/AccelerationBands.ts#L49)
