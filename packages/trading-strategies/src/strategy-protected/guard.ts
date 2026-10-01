import Big from 'big.js';

export type GuardOrderType = 'limit' | 'market';

type GuardDirection = 'stopLoss' | 'takeProfit';

type GuardKind = 'pct' | 'nominal' | 'price';

export interface Guard {
  direction: GuardDirection;
  kind: GuardKind;
  orderType: GuardOrderType;
  value: Big;
}

const DIRECTIONS = {
  stopLoss: {comparison: '<=', label: 'Stop-loss', thresholdSign: '-', valueSign: ''},
  takeProfit: {comparison: '>=', label: 'Take-profit', thresholdSign: '+', valueSign: '+'},
} as const;

/**
 * Builds the guard for one direction from its `Pct` / `Nominal` / `Price` config fields.
 * Zod's `.refine()` would turn the config schema into `ZodEffects`, which cannot be
 * `.extend()`-ed by subclasses, so mutual exclusion is validated here instead.
 */
export function parseGuard(
  direction: GuardDirection,
  fields: Partial<Record<GuardKind, string>>,
  orderType: GuardOrderType
): Guard | null {
  const configured = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (configured.length > 1) {
    throw new Error(
      `ProtectedStrategy: ${direction}Pct, ${direction}Nominal, and ${direction}Price are mutually exclusive — set at most one`
    );
  }
  const kinds: GuardKind[] = ['pct', 'nominal', 'price'];
  for (const kind of kinds) {
    const value = fields[kind];
    if (value !== undefined) {
      return {direction, kind, orderType, value: new Big(value)};
    }
  }
  return null;
}

/** Moves `base` by `offset` in the guard's direction: down for stop-loss, up for take-profit. */
function shift(direction: GuardDirection, base: Big, offset: Big) {
  return direction === 'stopLoss' ? base.minus(offset) : base.plus(offset);
}

export function guardTargetPrice(guard: Guard, avgEntry: Big, positionSize: Big): Big {
  switch (guard.kind) {
    case 'pct':
      return avgEntry.mul(shift(guard.direction, new Big(1), guard.value.div(100)));
    case 'nominal':
      return shift(guard.direction, avgEntry, guard.value.div(positionSize));
    case 'price':
      return guard.value;
  }
}

export function isGuardTriggered(guard: Guard, currentPrice: Big, targetPrice: Big) {
  return guard.direction === 'stopLoss' ? currentPrice.lte(targetPrice) : currentPrice.gte(targetPrice);
}

export function guardReason(guard: Guard, avgEntry: Big, currentPrice: Big, positionSize: Big, targetPrice: Big) {
  const {comparison, label, thresholdSign, valueSign} = DIRECTIONS[guard.direction];
  const orderSuffix = guard.orderType === 'limit' ? `(limit ${targetPrice.toFixed()})` : '(market)';
  switch (guard.kind) {
    case 'pct': {
      const pctChange = currentPrice.minus(avgEntry).div(avgEntry).mul(100);
      return `${label}: ${valueSign}${pctChange.toFixed(2)}% ${comparison} ${thresholdSign}${guard.value.toFixed(2)}% ${orderSuffix}`;
    }
    case 'nominal': {
      const unrealized = currentPrice.minus(avgEntry).mul(positionSize);
      return `${label}: unrealized ${valueSign}${unrealized.toFixed(2)} ${comparison} ${thresholdSign}${guard.value.toFixed(2)} ${orderSuffix}`;
    }
    case 'price':
      return `${label}: price ${currentPrice.toFixed()} ${comparison} target ${guard.value.toFixed()} ${orderSuffix}`;
  }
}
