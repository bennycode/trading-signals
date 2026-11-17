/** The calendar day of a timestamp, as `YYYY-MM-DD`. */
export function getDateString(date: Date): string {
  // An ISO timestamp always carries a date before its `T`, so the split cannot come back empty.
  return date.toISOString().slice(0, 'YYYY-MM-DD'.length);
}
