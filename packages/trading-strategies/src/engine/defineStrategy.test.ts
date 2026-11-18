import Big from 'big.js';
import {describe, expect, it} from 'vitest';
import type {z} from 'zod';
import {AlpacaBroker, OrderType} from '@typedtrader/exchange';
import {MarketType} from '../strategy/MarketType.js';
import type {TradingSessionState} from '../trader/index.js';
import {defineStrategy} from './defineStrategy.js';
import {required} from './index.js';
import {protection, ProtectionSchema} from './rules.js';
import {batched, candlesAt, tradingPair} from './testing.js';

type Settings = z.output<typeof ProtectionSchema>;

/** A strategy that always wants to be in, so anything it does not buy on is the engine's doing. */
const AlwaysIn = defineStrategy(ProtectionSchema)({
  long: {
    close: protection<Settings>(),
    open: {
      because: 'always in',
      spend: 'all',
      when: 'always',
    },
  },
  markets: [MarketType.BULLISH],
  name: '@typedtrader/strategy-test-always-in',
});

function state(options: {
  base: string;
  hasOutstandingBuy?: boolean;
  hasOutstandingSell?: boolean;
}): TradingSessionState {
  return {
    baseBalance: new Big(options.base),
    baseBalanceOnHold: new Big(0),
    counterBalance: new Big('1000'),
    feeRates: {[OrderType.LIMIT]: new Big(0), [OrderType.MARKET]: new Big(0)},
    hasOutstandingBuy: options.hasOutstandingBuy ?? false,
    hasOutstandingSell: options.hasOutstandingSell ?? false,
    shortBase: new Big(0),
    tradingRules: {...AlpacaBroker.DEFAULT_FRACTIONAL_TRADING_RULES, pair: tradingPair},
  };
}

describe('defineStrategy', () => {
  it('buys nothing between a sale of its own and the fill that reports it', async () => {
    /*
     * A stop fires, the sale goes through at the broker, and the fill notification is still on its
     * way — Trading212 polls them once a minute. The balance is already empty, so nothing is held,
     * while the ledger still carries the position and the exit it was sold with.
     */
    const [attach, drop, afterSale] = candlesAt(['100', '90', '91']);
    const strategy = new AlwaysIn({stopLossPct: '5'});

    await strategy.onCandle(batched(required(attach, 'attach candle')), state({base: '1'}));
    const exit = await strategy.onCandle(batched(required(drop, 'drop candle')), state({base: '1'}));
    expect(exit, 'the stop fires on the candle that breaks it').toBeDefined();

    const advice = await strategy.onCandle(
      batched(required(afterSale, 'candle after the sale')),
      state({base: '0', hasOutstandingSell: true})
    );

    expect(
      advice,
      'an entry rule that always matches must not buy back in on the candle after a stop fired'
    ).toBeUndefined();
    expect(strategy.ledger.size, "the position is still this engine's to account for until the fill").toBe('1');
  });

  it('places no second entry while the first one is still working', async () => {
    /*
     * The buy went out, the balance has not moved yet, and the fill that would count it as an
     * entry is still on its way. A rule eligible while flat would buy the position twice.
     */
    const strategy = new AlwaysIn();

    const first = await strategy.onCandle(batched(required(candlesAt(['100'])[0], 'first candle')), state({base: '0'}));
    expect(first, 'the entry rule fires while there is nothing held').toBeDefined();

    const second = await strategy.onCandle(
      batched(required(candlesAt(['101'])[0], 'next candle')),
      state({base: '0', hasOutstandingBuy: true})
    );

    expect(second, 'and says nothing more until the order it placed has an outcome').toBeUndefined();
  });

  it('opens again once an exit of its own turns out not to have been terminal', async () => {
    /*
     * The same gap, but the sale was nobody's kill switch: the position left the balance and the
     * exit that explains it is in. An entry rule is free to act from that point on.
     */
    const [attach, sold, afterFill] = candlesAt(['100', '101', '102']);
    const strategy = new AlwaysIn();

    await strategy.onCandle(batched(required(attach, 'attach candle')), state({base: '1'}));
    await strategy.onCandle(batched(required(sold, 'sold candle')), state({base: '0'}));

    const advice = await strategy.onCandle(batched(required(afterFill, 'candle after the fill')), state({base: '0'}));

    expect(strategy.ledger.size, 'an external close with no order of ours outstanding is accounted for at once').toBe(
      '0'
    );
    expect(advice, 'so the entry rule has nothing left to wait for').toBeDefined();
  });
});
