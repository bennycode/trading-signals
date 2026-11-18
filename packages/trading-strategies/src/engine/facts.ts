import Big from 'big.js';
import type {BatchedCandle, OneMinuteBatchedCandle} from '@typedtrader/exchange';
import {IndicatorNotReady} from './IndicatorNotReady.js';
import type {Facts, IndicatorHandle, IndicatorResults, PositionFacts} from './types.js';

/**
 * Indicator results reach rules through getters that throw {@link IndicatorNotReady} while the
 * indicator is still warming up. That replaces each strategy's own warm-up check: a rule that
 * reads an indicator waits for it, a rule that does not (a stop-loss) runs from the first
 * candle, and no rule body needs a null check. Facts are therefore built, never spread.
 */
function indicatorFacts<Indicators>(
  indicators: Map<string, IndicatorHandle<unknown>>,
  read: (indicator: IndicatorHandle<unknown>) => unknown
): IndicatorResults<Indicators> {
  const facts: Record<string, unknown> = {};

  for (const [name, indicator] of indicators) {
    Object.defineProperty(facts, name, {
      enumerable: true,
      get: () => {
        const result = read(indicator);
        if (result === undefined || result === null) {
          throw new IndicatorNotReady(name);
        }
        return result;
      },
    });
  }

  return facts as IndicatorResults<Indicators>;
}

/**
 * Everything a rule may read about one evaluation. Built fresh each time and never spread, because
 * the indicator values are getters that throw while their indicator is still warming up.
 *
 * `prices` is the candle itself, or the completed bar of a rule that declared a timeframe.
 */
export function factsFor<Config, Indicators>(options: {
  candle: OneMinuteBatchedCandle;
  config: Config;
  indicators: Map<string, IndicatorHandle<unknown>>;
  ledger: {
    bestPrice: string;
    costBasis: string;
    entries: number;
    exits: number;
    lastExitFinal: boolean;
    lastExitPrice: string | null;
    size: string;
  };
  prices: BatchedCandle;
}): Facts<Config, IndicatorResults<Indicators>> {
  const {candle, config, indicators, ledger, prices} = options;
  const size = new Big(ledger.size);
  const lastExitPrice = ledger.lastExitPrice;

  let position: PositionFacts | null = null;
  if (size.gt(0)) {
    const entryPrice = new Big(ledger.costBasis).div(size);
    position = {
      bestPrice: new Big(ledger.bestPrice),
      entryPrice,
      side: 'long',
      size,
      unrealizedPct: candle.close.minus(entryPrice).div(entryPrice).mul(100),
    };
  }

  return Object.assign(
    indicatorFacts<Indicators>(indicators, indicator => indicator.getResult()),
    {
      candle,
      close: prices.close.toNumber(),
      config,
      entries: ledger.entries,
      exits: ledger.exits,
      high: prices.high.toNumber(),
      lastExit: lastExitPrice === null ? null : {final: ledger.lastExitFinal, price: new Big(lastExitPrice)},
      low: prices.low.toNumber(),
      position,
    }
  );
}
