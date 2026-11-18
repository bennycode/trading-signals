import Big from 'big.js';
import type {TradingRules} from '../Broker.js';
import type {TradingPair} from '../TradingPair.js';
import type {IbkrContractInfo} from './api/schema/ContractSchema.js';

/**
 * Turns a contract's rules into the neutral {@link TradingRules}.
 *
 * Kept out of the broker because almost all of it is deciding which of IBKR's several
 * size-and-price fields actually constrain an order, and which only describe its order ticket.
 */
export function toIbkrTradingRules(info: IbkrContractInfo, pair: TradingPair): TradingRules {
  const rules = info.rules;

  /*
   * IBKR varies the price tick by price band and returns the bands in `incrementRules`. The
   * neutral `TradingRules` holds one scalar, so it has to be the tick that is legal in *every*
   * band, which is the coarsest rather than the finest: with bands of 0.01 below 100 and 0.05
   * above, advertising 0.01 invites a price like 100.01 that the upper band rejects, and both
   * order sizing and `getProfitableExitPrice` would then produce an unplaceable price. The
   * coarsest is safe everywhere because IBKR's bands are multiples of one another.
   */
  const increments = (rules?.incrementRules ?? [])
    .map(rule => rule.increment)
    .filter((increment): increment is number => typeof increment === 'number' && increment > 0);
  const priceIncrement = increments.length > 0 ? Math.max(...increments) : (rules?.increment ?? 0.01);

  /*
   * Deliberately not `rules.sizeIncrement`: that is the step the order ticket's quantity
   * spinner moves by (IBKR reports 40 for AAPL, which trades one share at a time), so using it
   * would invent a 40-share minimum. The real floor is one share, or a fraction of one when
   * the contract and account allow fractional orders.
   */
  const fractionalDigits = rules?.fraqInt;
  const supportsFractional =
    (rules?.fraqTypes?.length ?? 0) > 0 && typeof fractionalDigits === 'number' && fractionalDigits > 0;
  /*
   * `toFixed()` rather than `toString()`: Big.js switches to exponential notation below 1e-7,
   * and a `base_increment` of "1e-8" is not a decimal any consumer can parse.
   */
  const sizeIncrement = supportsFractional ? new Big(1).div(new Big(10).pow(fractionalDigits)).toFixed() : '1';

  return {
    base_increment: sizeIncrement,
    /*
     * IBKR documents no per-instrument maximum; limits are margin- and risk-based and are
     * enforced at submission. Reporting a finite cap here would invent one.
     */
    base_max_size: String(Number.MAX_SAFE_INTEGER),
    base_min_size: sizeIncrement,
    counter_increment: String(priceIncrement),
    counter_min_size: '0',
    pair,
  };
}
