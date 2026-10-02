import {ms} from 'ms';
import {getYearOverYearShares, type AlpacaAPI, type SecEdgarAPI} from '@typedtrader/exchange';
import {computeHypeScreen, type HypeScreenInput} from './computeHypeScreen.js';

/** The market the idiosyncratic volatility is measured against. */
const MARKET = 'SPY';

/** A trading year plus the month momentum skips, with room for weekends and holidays. */
const LOOKBACK = ms('400d');

/**
 * Builds the hype screen from free data: daily closes from Alpaca and diluted share counts from the
 * SEC. All judgement lives in the pure screen; this class only fetches, as of a given day, so the
 * same screen can be replayed on past days.
 */
export class HypeScreen {
  readonly #alpaca: Pick<AlpacaAPI, 'getStockBars'>;
  readonly #sec: Pick<SecEdgarAPI, 'getCompanyConcept' | 'getCompanyTickers'>;

  constructor(
    alpaca: Pick<AlpacaAPI, 'getStockBars'>,
    sec: Pick<SecEdgarAPI, 'getCompanyConcept' | 'getCompanyTickers'>
  ) {
    this.#alpaca = alpaca;
    this.#sec = sec;
  }

  /** Screens the tickers with what was known on the given day, best first. */
  async screen(tickers: readonly string[], asOf: Date) {
    const [closesByTicker, ciks] = await Promise.all([
      this.#getCloses([...tickers, MARKET], asOf),
      this.#sec.getCompanyTickers(),
    ]);
    const market = closesByTicker.get(MARKET) ?? new Map<string, number>();

    const inputs: HypeScreenInput[] = [];

    // One company at a time, because the SEC throttles clients that send more than ten requests a second.
    for (const ticker of tickers) {
      const closes = closesByTicker.get(ticker) ?? new Map<string, number>();
      const stockCloses: number[] = [];
      const marketCloses: number[] = [];

      // A stock missing a trading day is compared with the market on the days both traded.
      for (const [day, marketClose] of market) {
        const close = closes.get(day);
        if (close !== undefined) {
          stockCloses.push(close);
          marketCloses.push(marketClose);
        }
      }

      inputs.push({
        closes: stockCloses,
        dilutedShares: await this.#getDilutedShares(ciks.get(ticker.replace('.', '-')), asOf),
        marketCloses,
        ticker,
      });
    }

    return computeHypeScreen(inputs);
  }

  async #getCloses(symbols: string[], asOf: Date) {
    const closes = new Map<string, Map<string, number>>();
    let pageToken: string | undefined;

    do {
      const response = await this.#alpaca.getStockBars({
        end: asOf.toISOString(),
        feed: 'iex',
        limit: 10_000,
        page_token: pageToken,
        start: new Date(asOf.getTime() - LOOKBACK).toISOString(),
        symbols: symbols.join(','),
        timeframe: '1Day',
      });
      for (const [symbol, bars] of Object.entries(response.bars)) {
        const byDay = closes.get(symbol) ?? new Map<string, number>();
        bars.forEach(bar => byDay.set(bar.t, bar.c));
        closes.set(symbol, byDay);
      }
      pageToken = response.next_page_token ?? undefined;
    } while (pageToken);

    return closes;
  }

  async #getDilutedShares(cik: number | undefined, asOf: Date) {
    if (cik === undefined) {
      return null;
    }
    const concept = await this.#sec.getCompanyConcept(
      cik,
      'us-gaap',
      'WeightedAverageNumberOfDilutedSharesOutstanding'
    );
    return concept ? getYearOverYearShares(concept.units.shares ?? [], asOf) : null;
  }
}
