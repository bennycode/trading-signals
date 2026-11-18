import Big from 'big.js';
import type {OneMinuteBatchedCandle} from '@typedtrader/exchange';
import {ownedBase} from '../trader/sessionBalances.js';
import type {TradingSessionState} from '../trader/index.js';
import {adoptedPosition, closedPosition, resizedToOwned, type Ledger} from './ledger.js';

/**
 * What a candle changes about the position itself, before any rule is judged. A position can
 * appear, shrink or vanish without this engine placing anything: bought by hand, reduced by a
 * rebalance, sold by another strategy. Each answer is the patch to apply, or nothing to do.
 */
export type PositionChange = {
  /** `true` when this candle was not held through, so its high is not a best price we saw. */
  adopted: boolean;
  /** `true` when the position is gone for good and the strategy is finished with it. */
  final: boolean;
  patch: Partial<Ledger>;
};

/**
 * TODO: the entry price of a position this strategy did not open is taken from the candle it
 * first sees, so percentage rules measure from attach time rather than from what was actually
 * paid. Read `avg_entry_price` off the broker position once `TradingSessionState` carries it.
 */
function adoption(ledger: Ledger, state: TradingSessionState, candle: OneMinuteBatchedCandle): PositionChange | null {
  if (new Big(ledger.size).gt(0)) {
    return null;
  }

  /*
   * A buy of ours is still working, so this balance may be its doing. Its fill will account for
   * it; adopting it now would count the same purchase twice. A resting sell cannot have created a
   * position, so it is no reason to leave one unguarded.
   */
  if (state.hasOutstandingBuy) {
    return null;
  }

  return {adopted: true, final: false, patch: adoptedPosition(candle, ownedBase(state))};
}

/** A holding that changed size without a fill of ours, which its thresholds have to follow. */
function resize(ledger: Ledger, state: TradingSessionState, candle: OneMinuteBatchedCandle): PositionChange | null {
  /*
   * An order of ours is still working, so this size may be its doing and its fill will account
   * for it: following the balance now would count the same trade twice.
   */
  if (state.hasOutstandingSell || state.hasOutstandingBuy) {
    return null;
  }

  const patch = resizedToOwned(ledger, ownedBase(state), candle.close);
  return patch ? {adopted: false, final: false, patch} : null;
}

/** What a candle makes of a position the balance says is still there. */
export function heldPositionChange(
  ledger: Ledger,
  state: TradingSessionState,
  candle: OneMinuteBatchedCandle
): PositionChange | null {
  return adoption(ledger, state, candle) ?? resize(ledger, state, candle);
}

/**
 * What a candle makes of a position the balance says is gone. A sale of ours that has not been
 * reported yet is not an external close: reading it as one loses the price it sold at and can end
 * the session before its fill is in.
 *
 * A strategy with no entry rule is finished the moment it holds nothing, however the position
 * went, because it cannot buy one back — staying alive would only let it attach to whatever is
 * bought on this pair next.
 */
export function gonePositionChange(
  ledger: Ledger,
  state: TradingSessionState,
  candle: OneMinuteBatchedCandle,
  hasOpenRules: boolean
): PositionChange | null {
  if (state.hasOutstandingSell || new Big(ledger.size).lte(0)) {
    return null;
  }

  const final = ledger.pendingFinalExit !== null || !hasOpenRules;
  return {adopted: false, final, patch: closedPosition(ledger, candle.close, final)};
}
