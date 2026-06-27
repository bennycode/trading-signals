import type {FmpAPI} from '@typedtrader/exchange';
import {computeScorecard, selectForwardEps, type ScorecardInput, type ScorecardRow} from './computeScorecard.js';

/**
 * Builds the deterministic momentum scorecard from live Financial Modeling Prep data: it fetches the
 * raw figures per ticker, then hands them to {@link computeScorecard} for the actual scoring. All
 * judgement lives in the pure rubric — this class is only I/O.
 */
export class MomentumScorecard {
  readonly #fmp: FmpAPI;

  constructor(fmp: FmpAPI) {
    this.#fmp = fmp;
  }

  /** Scores each ticker (e.g. the momentum report's top winners), best-first. `now` anchors forward-year selection. */
  async build(tickers: string[], now: Date): Promise<ScorecardRow[]> {
    const inputs = await Promise.all(tickers.map(ticker => this.#fetchInput(ticker, now)));
    return computeScorecard(inputs);
  }

  /** Scores the tickers and returns them ranked best-first, for callers that only need the order. */
  async rank(tickers: string[], now: Date): Promise<string[]> {
    const rows = await this.build(tickers, now);
    return rows.map(row => row.ticker);
  }

  async #fetchInput(ticker: string, now: Date): Promise<ScorecardInput> {
    const [quote, target, estimates, ratings, targetSummary] = await Promise.all([
      this.#fmp.getQuote(ticker),
      this.#fmp.getPriceTargetConsensus(ticker),
      this.#fmp.getAnalystEstimates(ticker, 'annual'),
      this.#fmp.getRatingsSnapshot(ticker),
      this.#fmp.getPriceTargetSummary(ticker),
    ]);

    const {epsForwardYear1, epsForwardYear2} = selectForwardEps(estimates, now);

    return {
      epsForwardYear1,
      epsForwardYear2,
      movingAverage50: quote.priceAvg50,
      movingAverage200: quote.priceAvg200,
      price: quote.price,
      rating: ratings.rating,
      targetConsensus: target.targetConsensus,
      targetLastMonth: targetSummary.lastMonthAvgPriceTarget,
      targetLastQuarter: targetSummary.lastQuarterAvgPriceTarget,
      ticker,
    };
  }
}
