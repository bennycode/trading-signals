import {getCorrelation, getMaximum, getReturns, getStandardDeviation} from 'trading-signals';

/** Trading days in a year, a month and a quarter, the windows the factor literature works with. */
const YEAR = 252;
const MONTH = 21;
const QUARTER = 63;

export type HypeScreenInput = {
  ticker: string;
  /** Daily closes, oldest first. */
  closes: readonly number[];
  /** Daily closes of a market index on the same trading days, for the volatility the market explains. */
  marketCloses: readonly number[];
  /** Diluted share count of the latest quarter and of the same quarter a year earlier, or null when unknown. */
  dilutedShares: {current: number; yearAgo: number} | null;
};

export type HypeScreenFactors = {
  /** Return from twelve months ago to one month ago. Strong past winners tend to keep winning. */
  momentumPct: number | null;
  /** Largest single-day gain of the last month. Lottery-like jumps tend to be followed by weak returns. */
  maxDailyReturnPct: number | null;
  /** Daily volatility the market does not explain, over the last quarter. High values tend to underperform. */
  idiosyncraticVolatilityPct: number | null;
  /** Year-over-year growth of the diluted share count. Companies issuing shares tend to underperform. */
  dilutionPct: number | null;
};

export type HypeScreenRow = {
  ticker: string;
  factors: HypeScreenFactors;
  /** Each factor ranked against the screened universe, from 0 (worst) to 1 (best), or null when unknown. */
  percentiles: Record<keyof HypeScreenFactors, number | null>;
  /** Average of the known percentiles, or null when none is known. Low scores mark the names to filter out. */
  score: number | null;
};

/**
 * The 12-1 window of Jegadeesh & Titman (1993): the latest month is skipped because returns over
 * a single month tend to reverse.
 */
export function getMomentumPct(closes: readonly number[]) {
  if (closes.length <= YEAR) {
    return null;
  }
  const yearAgo = closes[closes.length - 1 - YEAR];
  const monthAgo = closes[closes.length - 1 - MONTH];
  return ((monthAgo - yearAgo) / yearAgo) * 100;
}

/** The MAX effect of Bali, Cakici & Whitelaw (2011). */
export function getMaxDailyReturnPct(closes: readonly number[]) {
  if (closes.length <= MONTH) {
    return null;
  }
  return getMaximum(getReturns(closes.slice(-MONTH - 1)));
}

/**
 * The idiosyncratic volatility of Ang, Hodrick, Xing & Zhang (2006), measured against the market
 * alone: what remains of a stock's daily volatility once the part that moves with the market is
 * removed.
 */
export function getIdiosyncraticVolatilityPct(closes: readonly number[], marketCloses: readonly number[]) {
  if (closes.length <= QUARTER) {
    return null;
  }
  const returns = getReturns(closes.slice(-QUARTER - 1));
  const marketReturns = getReturns(marketCloses.slice(-QUARTER - 1));
  const volatility = getStandardDeviation(returns);
  if (volatility === 0 || getStandardDeviation(marketReturns) === 0) {
    return volatility;
  }
  const correlation = getCorrelation(returns, marketReturns);
  return volatility * Math.sqrt(1 - correlation * correlation);
}

/** Share issuance of Pontiff & Woodgate (2008), as year-over-year growth of the diluted share count. */
export function getDilutionPct(dilutedShares: HypeScreenInput['dilutedShares']) {
  if (!dilutedShares || dilutedShares.yearAgo <= 0) {
    return null;
  }
  return ((dilutedShares.current - dilutedShares.yearAgo) / dilutedShares.yearAgo) * 100;
}

/**
 * Ranks values from 0 (worst) to 1 (best). Tied values share the average of the ranks they span,
 * so the order the stocks arrive in never changes a percentile.
 */
export function getPercentiles(values: readonly (number | null)[], higherIsBetter: boolean) {
  const known = values.filter(value => value !== null);
  return values.map(value => {
    if (value === null) {
      return null;
    }
    if (known.length === 1) {
      return 0.5;
    }
    const worse = known.filter(other => (higherIsBetter ? other < value : other > value)).length;
    const ties = known.filter(other => other === value).length;
    return (worse + (ties - 1) / 2) / (known.length - 1);
  });
}

/**
 * Screens stocks for the marks that separate hyped names from promising ones. Every factor is
 * ranked against the screened stocks rather than held to a fixed cutoff, and the ranks are averaged
 * with equal weights, so there is no threshold or weight to tune. Same inputs always yield the same
 * ranking, best first.
 */
export function computeHypeScreen(inputs: readonly HypeScreenInput[]) {
  for (const input of inputs) {
    if (input.closes.length !== input.marketCloses.length) {
      throw new Error(
        `The closes of "${input.ticker}" cover "${input.closes.length}" days, but the market closes cover "${input.marketCloses.length}".`
      );
    }
  }

  const factors: HypeScreenFactors[] = inputs.map(input => ({
    dilutionPct: getDilutionPct(input.dilutedShares),
    idiosyncraticVolatilityPct: getIdiosyncraticVolatilityPct(input.closes, input.marketCloses),
    maxDailyReturnPct: getMaxDailyReturnPct(input.closes),
    momentumPct: getMomentumPct(input.closes),
  }));

  // Only momentum rewards a high reading; the other three are the marks of hype, so a low one ranks best.
  const dilution = getPercentiles(
    factors.map(row => row.dilutionPct),
    false
  );
  const idiosyncraticVolatility = getPercentiles(
    factors.map(row => row.idiosyncraticVolatilityPct),
    false
  );
  const maxDailyReturn = getPercentiles(
    factors.map(row => row.maxDailyReturnPct),
    false
  );
  const momentum = getPercentiles(
    factors.map(row => row.momentumPct),
    true
  );

  const rows: HypeScreenRow[] = inputs.map((input, index) => {
    const percentiles = {
      dilutionPct: dilution[index],
      idiosyncraticVolatilityPct: idiosyncraticVolatility[index],
      maxDailyReturnPct: maxDailyReturn[index],
      momentumPct: momentum[index],
    };
    const known = Object.values(percentiles).filter(value => value !== null);
    return {
      factors: factors[index],
      percentiles,
      score: known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) / known.length,
      ticker: input.ticker,
    };
  });

  return rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.ticker.localeCompare(b.ticker));
}
