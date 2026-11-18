import type {z} from 'zod';
import {defineStrategy, protection, ProtectionSchema} from '../engine/index.js';
import {MarketType} from '../strategy/MarketType.js';

export const CoinFlipSchema = ProtectionSchema;
export type CoinFlipConfig = z.input<typeof CoinFlipSchema>;
type Settings = z.output<typeof CoinFlipSchema>;

/**
 * Bitwise AND rather than modulo: a Uint8 ranges 0–255, which is not evenly divisible by 100, so
 * modulo would bias the outcome.
 */
function headsUp(): boolean {
  const [byte = 0] = globalThis.crypto.getRandomValues(new Uint8Array(1));
  return (byte & 1) === 0;
}

/**
 * Flips a coin on every candle and buys or sells the whole balance accordingly. It exists as a
 * benchmark: a strategy worth running has to beat random, and this is random.
 */
export const CoinFlip = defineStrategy(CoinFlipSchema)({
  long: {
    close: [
      // A kill switch comes before the coin, so a run of bad flips cannot be ridden all the way down.
      ...protection<Settings>(),
      {
        because: 'Coin flip came up tails',
        quantity: 'all',
        when: () => !headsUp(),
      },
    ],
    open: {
      because: 'Coin flip came up heads',
      spend: 'all',
      when: headsUp,
    },
  },
  markets: [MarketType.BENCHMARK],
  name: '@typedtrader/strategy-coin-flip',
});
