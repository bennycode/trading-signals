[trading-signals](../README.md) / [Exports](../modules.md) / WSMA

# Class: WSMA

Wilder's Smoothed Moving Average (WSMA) Type: Trend

Developed by **John Welles Wilder, Jr.** to help identifying and spotting bullish and bearish trends. Similar to Exponential Moving Averages with the difference that a smoothing factor of 1/interval is being used, which makes it respond more slowly to price changes.

Synonyms:

- Modified Exponential Moving Average (MEMA)
- Smoothed Moving Average (SMMA)
- Welles Wilder's Smoothing (WWS)
- Wilder's Moving Average (WMA)

**`see`** https://tlc.thinkorswim.com/center/reference/Tech-Indicators/studies-library/V-Z/WildersSmoothing

## Hierarchy

- [`MovingAverage`](MovingAverage.md)

  ↳ **`WSMA`**

## Table of contents

### Constructors

- [constructor](WSMA.md#constructor)

### Properties

- [highest](WSMA.md#highest)
- [interval](WSMA.md#interval)
- [lowest](WSMA.md#lowest)

### Accessors

- [isStable](WSMA.md#isstable)

### Methods

- [getResult](WSMA.md#getresult)
- [update](WSMA.md#update)

## Constructors

### constructor

• **new WSMA**(`interval`)

#### Parameters

| Name       | Type     |
| :--------- | :------- |
| `interval` | `number` |

#### Overrides

[MovingAverage](MovingAverage.md).[constructor](MovingAverage.md#constructor)

#### Defined in

[WSMA/WSMA.ts:26](https://github.com/bennycode/trading-signals/blob/95cb489/src/WSMA/WSMA.ts#L26)

## Properties

### highest

• `Optional` **highest**: `Big`

Highest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[MovingAverage](MovingAverage.md).[highest](MovingAverage.md#highest)

#### Defined in

[Indicator.ts:22](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L22)

---

### interval

• `Readonly` **interval**: `number`

#### Inherited from

[MovingAverage](MovingAverage.md).[interval](MovingAverage.md#interval)

---

### lowest

• `Optional` **lowest**: `Big`

Lowest return value over the lifetime (not interval!) of the indicator.

#### Inherited from

[MovingAverage](MovingAverage.md).[lowest](MovingAverage.md#lowest)

#### Defined in

[Indicator.ts:24](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L24)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Inherited from

MovingAverage.isStable

#### Defined in

[Indicator.ts:27](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L27)

## Methods

### getResult

▸ **getResult**(): `Big`

#### Returns

`Big`

#### Inherited from

[MovingAverage](MovingAverage.md).[getResult](MovingAverage.md#getresult)

#### Defined in

[Indicator.ts:31](https://github.com/bennycode/trading-signals/blob/95cb489/src/Indicator.ts#L31)

---

### update

▸ **update**(`price`): `void` \| `Big`

#### Parameters

| Name    | Type        |
| :------ | :---------- |
| `price` | `BigSource` |

#### Returns

`void` \| `Big`

#### Overrides

[MovingAverage](MovingAverage.md).[update](MovingAverage.md#update)

#### Defined in

[WSMA/WSMA.ts:32](https://github.com/bennycode/trading-signals/blob/95cb489/src/WSMA/WSMA.ts#L32)
