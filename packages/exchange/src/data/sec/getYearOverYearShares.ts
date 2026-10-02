import {ms} from 'ms';
import type {CompanyFact} from './schema/CompanyConceptSchema.js';

/** A fiscal quarter runs 13 weeks, give or take the week a 52/53-week calendar shifts it. */
const QUARTER_MIN = ms('80d');
const QUARTER_MAX = ms('100d');
const YEAR = ms('365d');
const YEAR_TOLERANCE = ms('15d');

/**
 * Picks the share count of the latest quarter and of the same quarter a year earlier, as they were
 * public on a given day.
 *
 * Both come from the same filing: a quarterly report restates the year-ago quarter next to the
 * current one, already adjusted for any stock split in between. Pairing values from two different
 * filings would read a split as massive dilution. Year-to-date and annual values are skipped, so a
 * quarter is only ever compared with a quarter.
 */
export function getYearOverYearShares(facts: readonly CompanyFact[], asOf: Date) {
  const quarters = facts.filter(fact => {
    if (fact.start === undefined || Date.parse(fact.filed) > asOf.getTime()) {
      return false;
    }
    const length = Date.parse(fact.end) - Date.parse(fact.start);
    return length >= QUARTER_MIN && length <= QUARTER_MAX;
  });

  const latestFiled = quarters.reduce<CompanyFact | undefined>(
    (latest, fact) => (latest === undefined || fact.filed > latest.filed ? fact : latest),
    undefined
  );
  if (latestFiled === undefined) {
    return null;
  }

  const filing = quarters.filter(fact => fact.accn === latestFiled.accn);
  const current = filing.reduce((latest, fact) => (fact.end > latest.end ? fact : latest));
  const yearAgo = filing.find(fact => {
    const distance = Date.parse(current.end) - Date.parse(fact.end);
    return Math.abs(distance - YEAR) <= YEAR_TOLERANCE;
  });

  return yearAgo ? {current: current.val, yearAgo: yearAgo.val} : null;
}
