/**
 * Get the weekday name for a given date in a specific timezone.
 * Uses IANA timezone identifiers (e.g., 'America/New_York', 'Europe/London').
 */
export function getWeekday(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  }).format(date);
}

/**
 * Check if the given date is a Monday in the specified timezone.
 */
export function isMonday(date: Date, timezone: string): boolean {
  return getWeekday(date, timezone) === 'Monday';
}

/**
 * Check if the given date is a Tuesday in the specified timezone.
 */
export function isTuesday(date: Date, timezone: string): boolean {
  return getWeekday(date, timezone) === 'Tuesday';
}

/**
 * Check if the given date is a Wednesday in the specified timezone.
 */
export function isWednesday(date: Date, timezone: string): boolean {
  return getWeekday(date, timezone) === 'Wednesday';
}

/**
 * Check if the given date is a Thursday in the specified timezone.
 */
export function isThursday(date: Date, timezone: string): boolean {
  return getWeekday(date, timezone) === 'Thursday';
}

/**
 * Check if the given date is a Friday in the specified timezone.
 */
export function isFriday(date: Date, timezone: string): boolean {
  return getWeekday(date, timezone) === 'Friday';
}

/**
 * Check if the given date is a Saturday in the specified timezone.
 */
export function isSaturday(date: Date, timezone: string): boolean {
  return getWeekday(date, timezone) === 'Saturday';
}

/**
 * Check if the given date is a Sunday in the specified timezone.
 */
export function isSunday(date: Date, timezone: string): boolean {
  return getWeekday(date, timezone) === 'Sunday';
}
