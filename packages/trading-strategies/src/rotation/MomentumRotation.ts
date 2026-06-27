import type {AlpacaAPI} from '@typedtrader/exchange';
import {computeRebalance, type Holding, type RebalancePlan} from './computeRebalance.js';
import {getExchangeYearMonth, getMomentumWindow} from '../report-sp500-momentum/SP500MomentumReport.js';
import {getMomentumRanking} from '../util/momentumRanking.js';
import {SP500_TIMEZONE} from '../util/sp500Tickers.js';

/**
 * Anything that can rank a set of tickers best-first. Both `MomentumScorecard` (FMP) and
 * `TipRanksScorecard` satisfy it, so the rotation is agnostic to which data provider scores the picks.
 */
export interface PortfolioScorer {
  rank(tickers: string[], now: Date): Promise<string[]>;
}

export interface MomentumRotationConfig {
  /** Number of equal-weight positions to hold. */
  positionCount: number;
  /** Number of top momentum winners fed into the scorer before picking the best `positionCount`. */
  momentumPoolSize: number;
}

const DEFAULT_CONFIG: MomentumRotationConfig = {momentumPoolSize: 20, positionCount: 5};

/**
 * Live momentum-rotation strategy.
 *
 * Each run it rebuilds the target portfolio (rank the S&P 500 by 12-1 momentum, score the top
 * winners, keep the best `positionCount`) and trades the minimum needed to match it: liquidate names
 * that dropped out, buy new entrants at an equal-weight slice, and leave everything else alone.
 *
 * Because the 12-1 momentum window is a monthly snapshot, the natural cadence is monthly — that is
 * when "momentum changes". The scorecard uses *current* analyst data, so this only makes sense run
 * forward (live or paper); it cannot be backtested faithfully.
 *
 * Use {@link plan} to preview the trades (read-only) and {@link rebalance} to actually place them.
 */
export class MomentumRotation {
  readonly #alpaca: AlpacaAPI;
  readonly #scorer: PortfolioScorer;
  readonly #config: MomentumRotationConfig;

  constructor(alpaca: AlpacaAPI, scorer: PortfolioScorer, config: Partial<MomentumRotationConfig> = {}) {
    this.#alpaca = alpaca;
    this.#scorer = scorer;
    this.#config = {...DEFAULT_CONFIG, ...config};
  }

  /** The target portfolio: the top momentum winners, scored, reduced to the best `positionCount`. */
  async selectTargets(now: Date): Promise<string[]> {
    const {month, year} = getExchangeYearMonth(now.toISOString(), SP500_TIMEZONE);
    const ranking = await getMomentumRanking(this.#alpaca, getMomentumWindow(year, month));
    const winners = ranking.slice(0, this.#config.momentumPoolSize).map(result => result.ticker);
    const ranked = await this.#scorer.rank(winners, now);
    return ranked.slice(0, this.#config.positionCount);
  }

  /** Builds the rebalance plan without placing any orders, so it can be reviewed or paper-traded first. */
  async plan(now: Date): Promise<{plan: RebalancePlan; targets: string[]}> {
    const {plan, targets} = await this.#buildPlan(now);
    return {plan, targets};
  }

  /** Builds the plan and executes it: liquidate dropouts first to free cash, then buy the new entrants. */
  async rebalance(now: Date): Promise<{plan: RebalancePlan; targets: string[]}> {
    const {plan, positions, targets} = await this.#buildPlan(now);
    const quantityByTicker = new Map(positions.map(position => [position.symbol, position.qty]));

    for (const sell of plan.sells) {
      await this.#alpaca.postOrder({
        qty: quantityByTicker.get(sell.ticker),
        side: 'sell',
        symbol: sell.ticker,
        time_in_force: 'day',
        type: 'market',
      });
    }
    for (const buy of plan.buys) {
      await this.#alpaca.postOrder({
        notional: buy.notionalUsd.toFixed(2),
        side: 'buy',
        symbol: buy.ticker,
        time_in_force: 'day',
        type: 'market',
      });
    }

    return {plan, targets};
  }

  async #buildPlan(now: Date) {
    const targets = await this.selectTargets(now);
    const [positions, account] = await Promise.all([this.#alpaca.getPositions(), this.#alpaca.getAccount()]);
    const holdings: Holding[] = positions.map(position => ({
      marketValueUsd: Number(position.market_value),
      ticker: position.symbol,
    }));
    const plan = computeRebalance(holdings, targets, Number(account.equity), this.#config.positionCount);
    return {plan, positions, targets};
  }
}
