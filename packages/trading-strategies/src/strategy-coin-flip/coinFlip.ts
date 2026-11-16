import {z} from 'zod';
import {defineStrategy} from '../engine/index.js';
import {MarketType} from '../strategy/MarketType.js';

export const CoinFlipSchema = z.object({});
export type CoinFlipConfig = z.input<typeof CoinFlipSchema>;

/**
 * Bitwise AND rather than modulo: a Uint8 ranges 0–255, which is not evenly divisible by 100, so
 * modulo would bias the outcome.
 */
function headsUp(): boolean {
  return (globalThis.crypto.getRandomValues(new Uint8Array(1))[0] & 1) === 0;
}

/**
 * Flips a coin on every candle and buys or sells the whole balance accordingly. It exists as a
 * benchmark: a strategy worth running has to beat random, and this is random.
 */
export const CoinFlip = defineStrategy(CoinFlipSchema)({
  long: {
    close: {
      because: 'Coin flip came up tails',
      quantity: 'all',
      when: () => !headsUp(),
    },
    open: {
      because: 'Coin flip came up heads',
      spend: 'all',
      when: headsUp,
    },
  },
  markets: [MarketType.BENCHMARK],
  name: '@typedtrader/strategy-coin-flip',
});
