/*
 * The shape a score card has, with nothing in it that computes one. A card is what a producer
 * fills in and a surface renders, so the two never have to agree on anything beyond these types:
 * a CLI table, a chat message and a JSON payload can all read any card, including cards written
 * after the renderer was.
 */

/**
 * A score together with what it is out of, because the number alone does not say what it means:
 * 25 out of 100 is a chart with most of the evidence against it, while #25 of 503 is one of the
 * strongest names in the field. `ratio` counts up from 0 and higher is better; `rank` counts from
 * 1 and lower is better.
 */
export type Score = {
  kind: 'rank' | 'ratio';
  outOf: number;
  value: number;
};

/**
 * One comparison a criterion made, kept so a reader can see whether it missed by a mile or by a
 * hair. A bare `fired: false` cannot be reviewed: price 25% under a still-rising average and price
 * a cent under it are the same answer until the numbers are on the page.
 */
export type Measurement = {
  /**
   * How far {@link Measurement.reading} sits from {@link Measurement.limit}, in percent of the
   * limit. Negative means below the limit. `null` where a percentage would be meaningless, as
   * against a zero line.
   */
  deviationPercent: number | null;
  /**
   * What produced the reading, named as a trader would say it: `SMA 50`, `RSI 14`, `OBV`,
   * `12-1 return`. It carries the period, since a row saying `SMA 50` about a 20-bar average
   * would be a lie.
   */
  indicator: string;
  /** What the two numbers are, short enough to scan down a column. */
  label: string;
  /** The line this criterion watches: an average, a band, a threshold, or a benchmark's own move. */
  limit: number;
  reading: number;
};

/**
 * One field of a card: a question, what answering it is worth, and the measurements behind the
 * answer. Whether a `true` is good or bad news belongs to the card rather than the field, so that
 * a reader never has to work out which way each question points. See
 * {@link ScoreCard.firedMeans}.
 */
export type Criterion<Name extends string = string, Category extends string = string> = {
  /** Kind of evidence the field draws on, used to tell broad agreement from one loud voice. */
  category: Category;
  /**
   * `null` when there was nothing to read the field against, which is not the same answer as
   * `false`: an unread field moves the score by nothing, so it flatters it by its own weight.
   */
  fired: boolean | null;
  /** Empty for a field that could not be read at all, since it compared nothing. */
  measures: Measurement[];
  /** The domain term a trader would look up, such as a death cross. */
  name: Name;
  /** The field in plain words, as a question, for anyone reading the card rather than writing it. */
  question: string;
  weight: number;
};

export type ScoreCard<Criteria extends Criterion = Criterion, Verdict extends string = string> = {
  /**
   * Open of the last bar the fields read. A score with no date on it cannot be compared with the
   * next one, and a feed that withholds the session still forming makes the latest bar older than
   * the moment of the reading.
   */
  asOf: string;
  criteria: Criteria[];
  /**
   * Which direction a fired field pushes the score, declared once for the whole card. A weakness
   * card asks questions whose "yes" is the bad answer and deducts; an opportunity card asks
   * questions whose "yes" is the good answer and adds. Without this a renderer cannot mark a row
   * as good or bad news, and the two kinds of card would need two renderers.
   */
  firedMeans: 'strength' | 'weakness';
  /**
   * `null` when the card's questions did not apply to the instrument at all, which is not the same
   * as scoring zero: zero is a verdict, and a reader may rank it against another zero. A card with
   * no score must be left out of a ranking rather than placed at the bottom of one.
   */
  score: Score | null;
  verdict: Verdict;
};

/**
 * How a score reads to a person: `25/100` for a ratio, `#14 of 503` for a rank. Every surface
 * prints it the same way, so a score cannot mean one thing in a chat message and another in a
 * table.
 */
export function formatScore(score: Score): string {
  return score.kind === 'rank' ? `#${score.value} of ${score.outOf}` : `${score.value}/${score.outOf}`;
}

/**
 * Weight of the fields that had nothing to read, so the score is optimistic by up to this much. A
 * reading of 60 with 15 unread covers everything from 45 to 60, and a card that hides it invites
 * a comparison between two scores that were not measuring the same thing.
 */
export function unreadWeight(criteria: Criterion[]): number {
  return criteria.reduce((total, criterion) => (criterion.fired === null ? total + criterion.weight : total), 0);
}
