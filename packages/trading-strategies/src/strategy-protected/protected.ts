import type {z} from 'zod';
import {defineStrategy, protection, ProtectionSchema} from '../engine/index.js';
import {MarketType} from '../strategy/MarketType.js';

export const ProtectedSchema = ProtectionSchema;

export type ProtectedConfig = z.input<typeof ProtectedSchema>;
type Settings = z.output<typeof ProtectedSchema>;

/**
 * Nothing but the two kill switches, for a position this strategy did not open: bought by hand,
 * by another strategy, or carried across a restart. It has no entry rule, so there is nothing to
 * buy the position back once a switch has sold it.
 */
export const Protected = defineStrategy(ProtectedSchema)({
  long: {
    close: protection<Settings>(),
  },
  markets: [MarketType.UTILITY],
  name: '@typedtrader/strategy-protected',
});
