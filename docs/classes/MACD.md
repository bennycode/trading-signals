[trading-signals](../README.md) / [Exports](../modules.md) / MACD

# Class: MACD

Moving Average Convergence Divergence (MACD) Type: Momentum

The MACD triggers trading signals when it crosses above (bullish buying opportunity) or below (bearish selling opportunity) its signal line. MACD can be used together with the RSI to provide a more accurate trading signal.

**`see`** https://www.investopedia.com/terms/m/macd.asp

## Implements

- [`Indicator`](../interfaces/Indicator.md)<[`MACDResult`](../modules.md#macdresult)\>

## Table of contents

### Constructors

- [constructor](MACD.md#constructor)

### Properties

- [long](MACD.md#long)
- [prices](MACD.md#prices)
- [short](MACD.md#short)

### Accessors

- [isStable](MACD.md#isstable)

### Methods

- [getResult](MACD.md#getresult)
- [update](MACD.md#update)

## Constructors

### constructor

• **new MACD**(`config`)

#### Parameters

| Name     | Type                                     |
| :------- | :--------------------------------------- |
| `config` | [`MACDConfig`](../modules.md#macdconfig) |

#### Defined in

[MACD/MACD.ts:42](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L42)

## Properties

### long

• `Readonly` **long**: [`EMA`](EMA.md) \| [`DEMA`](DEMA.md)

#### Defined in

[MACD/MACD.ts:36](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L36)

---

### prices

• `Readonly` **prices**: `BigSource`[] = `[]`

#### Defined in

[MACD/MACD.ts:35](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L35)

---

### short

• `Readonly` **short**: [`EMA`](EMA.md) \| [`DEMA`](DEMA.md)

#### Defined in

[MACD/MACD.ts:37](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L37)

## Accessors

### isStable

• `get` **isStable**(): `boolean`

#### Returns

`boolean`

#### Implementation of

[Indicator](../interfaces/Indicator.md).[isStable](../interfaces/Indicator.md#isstable)

#### Defined in

[MACD/MACD.ts:48](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L48)

## Methods

### getResult

▸ **getResult**(): [`MACDResult`](../modules.md#macdresult)

#### Returns

[`MACDResult`](../modules.md#macdresult)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[getResult](../interfaces/Indicator.md#getresult)

#### Defined in

[MACD/MACD.ts:87](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L87)

---

### update

▸ **update**(`_price`): `void` \| [`MACDResult`](../modules.md#macdresult)

#### Parameters

| Name     | Type        |
| :------- | :---------- |
| `_price` | `BigSource` |

#### Returns

`void` \| [`MACDResult`](../modules.md#macdresult)

#### Implementation of

[Indicator](../interfaces/Indicator.md).[update](../interfaces/Indicator.md#update)

#### Defined in

[MACD/MACD.ts:52](https://github.com/bennycode/trading-signals/blob/95cb489/src/MACD/MACD.ts#L52)
