import assert from 'node:assert';
import Big from 'big.js';
import {OrderSide, OrderType, type OrderOptions, type TradingRules} from './Broker.js';

interface CandleRange {
  open: Big;
  low: Big;
  high: Big;
}

export function roundDownToIncrement(value: Big, increment: Big) {
  return value.div(increment).round(0, Big.roundDown).mul(increment);
}

/** Market orders pay for immediacy: the fill lands worse than the candle open, never better. */
export function marketFillPrice(side: OrderSide, candle: CandleRange, slippageRate: Big, clamp: boolean) {
  if (side === OrderSide.BUY) {
    const slipped = candle.open.mul(new Big(1).plus(slippageRate));
    return clamp && slipped.gt(candle.high) ? candle.high : slipped;
  }
  const slipped = candle.open.mul(new Big(1).minus(slippageRate));
  return clamp && slipped.lt(candle.low) ? candle.low : slipped;
}

/**
 * A limit buy fills once the candle trades at or below its price, a limit sell once it
 * trades at or above. Either way the fill gets price improvement from the candle open.
 * Returns `null` when the candle never reached the limit.
 */
export function limitFillPrice(side: OrderSide, limitPrice: Big, candle: CandleRange) {
  if (side === OrderSide.BUY) {
    if (candle.low.gt(limitPrice)) {
      return null;
    }
    return limitPrice.lt(candle.open) ? limitPrice : candle.open;
  }
  if (candle.high.lt(limitPrice)) {
    return null;
  }
  return limitPrice.gt(candle.open) ? limitPrice : candle.open;
}

/** Rounds `size` to the base increment, or returns `null` when it breaks a minimum size rule. */
export function applyTradingRules(size: Big, options: OrderOptions, rules: TradingRules) {
  const rounded = roundDownToIncrement(size, new Big(rules.base_increment));

  if (rounded.lt(rules.base_min_size)) {
    return null;
  }

  // Check minimum notional
  if (options.type === OrderType.LIMIT) {
    const price = roundDownToIncrement(new Big(options.price), new Big(rules.counter_increment));
    if (rounded.mul(price).lt(rules.counter_min_size)) {
      return null;
    }
  }

  return rounded;
}

/**
 * Rule enforcement for counter-sized (notional) orders. The base quantity is only known
 * at fill time, so the base minimum is checked against an estimate from the current
 * price — mirroring a real broker rejecting an order that is too small to execute.
 */
export function applyNotionalTradingRules(
  counterAmount: Big,
  rules: TradingRules,
  estimate: {price: Big; feeRate: Big} | undefined
) {
  const size = roundDownToIncrement(counterAmount, new Big(rules.counter_increment));
  assert.ok(
    size.gte(rules.counter_min_size),
    `Notional size "${size.toFixed()}" is below the minimum of "${rules.counter_min_size}"`
  );

  if (estimate) {
    const estimatedBase = size.div(new Big(1).plus(estimate.feeRate)).div(estimate.price);
    assert.ok(
      estimatedBase.gte(rules.base_min_size),
      `Notional size "${size.toFixed()}" buys an estimated "${estimatedBase.toFixed()}" base units, below the minimum of "${rules.base_min_size}"`
    );
  }

  return size;
}
