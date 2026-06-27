import type {TipRanksAPI} from '@typedtrader/exchange';
import {
  computeTipRanksScorecard,
  type TipRanksScorecardInput,
  type TipRanksScorecardRow,
} from './computeTipRanksScorecard.js';

/**
 * Builds the TipRanks scorecard from live TipRanks MCP data. Two batch calls cover the whole list:
 * `getAssetsData` (price, Smart Score, consensus, target, trailing P/E) and `getTechnicalAnalysis`
 * (the 200-day moving average). All scoring lives in the pure {@link computeTipRanksScorecard}; this
 * class is only I/O and null-handling.
 *
 * It is a free, backward-looking alternative to the FMP scorecard: no forward P/E, EPS growth, or
 * revision/falling-knife signals, and TipRanks quotes can lag. Use it when cost matters more than
 * those forward signals.
 */
export class TipRanksScorecard {
  readonly #tipranks: TipRanksAPI;

  constructor(tipranks: TipRanksAPI) {
    this.#tipranks = tipranks;
  }

  /** Scores the tickers and returns them ranked best-first. */
  async rank(tickers: string[]): Promise<string[]> {
    const rows = await this.build(tickers);
    return rows.map(row => row.ticker);
  }

  async build(tickers: string[]): Promise<TipRanksScorecardRow[]> {
    const [assets, technicals] = await Promise.all([
      this.#tipranks.getAssetsData(tickers),
      this.#tipranks.getTechnicalAnalysis(tickers),
    ]);

    const movingAverageByTicker = new Map(
      technicals.map(technical => [technical.ticker, technical.movingAveragesAnalysis.simple.mA200.score])
    );

    const inputs: TipRanksScorecardInput[] = [];
    for (const asset of assets) {
      const movingAverage200 = movingAverageByTicker.get(asset.ticker);
      if (movingAverage200 === undefined) {
        continue; // no 200-day MA -> can't score extension, skip the ticker
      }
      inputs.push({
        consensus: asset.analystConsensus ?? 'Hold',
        movingAverage200,
        price: asset.price,
        smartScore: asset.smartScore ?? 0,
        targetConsensus: asset.priceTarget ?? asset.price, // no target -> 0% upside
        ticker: asset.ticker,
        trailingPE: asset.peRatio ?? 0, // null P/E (loss-making) -> scores as -1
      });
    }

    return computeTipRanksScorecard(inputs);
  }
}
