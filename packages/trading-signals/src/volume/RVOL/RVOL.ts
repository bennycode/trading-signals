import {IndicatorSeries} from '../../types/Indicator.js';

export type RVOLInput = {
  /** Bar opening time in ISO 8601 (e.g. `2026-05-08T14:30:00.000Z`). Date determines the
   * trading session; UTC time-of-minute keys the volume curve. */
  openTimeInISO: string;
  volume: number;
};

type SessionCurve = {
  /** UTC date (`YYYY-MM-DD`) — used to detect session boundaries. */
  date: string;
  /** Cumulative volume up to and including each minute-of-day, keyed by `hour * 60 + minute`. */
  cumulativeByMinute: Map<number, number>;
};

/**
 * Relative Volume (RVOL).
 *
 * Compares the cumulative volume traded so far in the current session to the *expected*
 * cumulative volume at the same minute-of-day, averaged over the last `lookbackSessions`
 * completed sessions. A value of `1.0` means today's volume profile is tracking the
 * historical average; `> 1.5` is elevated, `> 2.0` is high, `> 3.0` is extreme.
 *
 * Unlike daily-total volume comparisons (which only become meaningful at session close),
 * RVOL is intraday: at 10:30 AM it answers "is more or less volume flowing than usual at
 * this point in the session?" — a real-time signal that a strategy can act on.
 *
 * Inputs must carry an `openTimeInISO` so the indicator can detect session changes (date
 * rollover) and align bars across sessions by minute-of-day. The first valid result comes
 * after at least one *completed* prior session; before then `getResult()` returns
 * `undefined` and `isStable` is `false`.
 *
 * Designed for US-equity 1-minute bars (single contiguous session per UTC date). Crypto
 * or 24h instruments need a different session-boundary definition.
 *
 * @see https://www.investopedia.com/terms/r/relative-volume.asp
 */
export class RVOL extends IndicatorSeries<RVOLInput> {
  readonly #lookbackSessions: number;
  readonly #pastSessions: SessionCurve[] = [];
  #currentSession: SessionCurve | null = null;
  #currentCumulative = 0;
  /** Snapshot of state before the most recent `update()` so `replace()` can roll back. */
  #snapshot: {
    pastSessions: SessionCurve[];
    currentSession: SessionCurve | null;
    currentCumulative: number;
    previousResult: number | undefined;
  } | null = null;

  constructor(lookbackSessions: number = 20) {
    super();
    if (lookbackSessions < 1) {
      throw new Error(`lookbackSessions must be >= 1, got ${lookbackSessions}`);
    }
    this.#lookbackSessions = lookbackSessions;
  }

  override getRequiredInputs() {
    // Approximation: at minimum one full session has to complete before RVOL produces
    // a result. For a regular US session that's 390 1-min bars. The exact count depends
    // on the bar interval and whether the feed includes extended hours, so consumers
    // should rely on `isStable` rather than this number.
    return 391;
  }

  override update(input: RVOLInput, replace: boolean): number | null {
    if (replace) {
      this.#restoreSnapshot();
    } else {
      this.#takeSnapshot();
    }

    const {date, minuteOfDay} = parseTimestamp(input.openTimeInISO);

    if (!this.#currentSession || this.#currentSession.date !== date) {
      // Roll the previous session into history (if any), then start fresh.
      if (this.#currentSession) {
        this.#pastSessions.push(this.#currentSession);
        if (this.#pastSessions.length > this.#lookbackSessions) {
          this.#pastSessions.shift();
        }
      }
      this.#currentSession = {cumulativeByMinute: new Map(), date};
      this.#currentCumulative = 0;
    }

    this.#currentCumulative += input.volume;
    this.#currentSession.cumulativeByMinute.set(minuteOfDay, this.#currentCumulative);

    if (this.#pastSessions.length === 0) {
      return null;
    }

    const expected = this.#expectedCumulativeAt(minuteOfDay);
    if (expected === null || expected === 0) {
      return null;
    }

    return this.setResult(this.#currentCumulative / expected, replace);
  }

  /**
   * Mean cumulative volume at `minuteOfDay` across past sessions. Sessions that didn't
   * trade at this minute (e.g. a halted bar) contribute their *last known* cumulative
   * volume up to that point — preserves the curve shape without zero-stuffing gaps.
   */
  #expectedCumulativeAt(minuteOfDay: number): number | null {
    let sum = 0;
    let count = 0;
    for (const session of this.#pastSessions) {
      const value = lookupCumulativeAtOrBefore(session.cumulativeByMinute, minuteOfDay);
      if (value !== null) {
        sum += value;
        count++;
      }
    }
    return count === 0 ? null : sum / count;
  }

  #takeSnapshot() {
    this.#snapshot = {
      currentCumulative: this.#currentCumulative,
      currentSession: this.#currentSession
        ? {
            cumulativeByMinute: new Map(this.#currentSession.cumulativeByMinute),
            date: this.#currentSession.date,
          }
        : null,
      pastSessions: this.#pastSessions.map(session => ({
        cumulativeByMinute: new Map(session.cumulativeByMinute),
        date: session.date,
      })),
      previousResult: this.previousResult,
    };
  }

  #restoreSnapshot() {
    if (!this.#snapshot) {
      throw new Error('Cannot replace before any input has been added.');
    }
    this.#pastSessions.length = 0;
    this.#pastSessions.push(...this.#snapshot.pastSessions);
    this.#currentSession = this.#snapshot.currentSession;
    this.#currentCumulative = this.#snapshot.currentCumulative;
    this.previousResult = this.#snapshot.previousResult;
  }
}

function parseTimestamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ISO timestamp: "${iso}"`);
  }
  return {
    date: iso.slice(0, 10),
    minuteOfDay: date.getUTCHours() * 60 + date.getUTCMinutes(),
  };
}

/**
 * Returns the cumulative volume at `minute` if recorded, or the most recent value before
 * `minute` if there's a gap (e.g. a halted bar). `null` if the session hadn't started yet
 * by `minute`.
 */
function lookupCumulativeAtOrBefore(cumulativeByMinute: Map<number, number>, minute: number): number | null {
  if (cumulativeByMinute.has(minute)) {
    return cumulativeByMinute.get(minute)!;
  }
  let bestKey = -1;
  for (const key of cumulativeByMinute.keys()) {
    if (key <= minute && key > bestKey) {
      bestKey = key;
    }
  }
  return bestKey === -1 ? null : cumulativeByMinute.get(bestKey)!;
}
