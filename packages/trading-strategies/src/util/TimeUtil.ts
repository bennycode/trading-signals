/** The calendar day of a timestamp, as `YYYY-MM-DD`. */
export function getDateString(date: Date): string {
  // An ISO timestamp always opens with the date, so the first ten characters are always it.
  return date.toISOString().slice(0, 'YYYY-MM-DD'.length);
}
