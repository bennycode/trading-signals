/**
 * Get the weekday name for a given date in a specific timezone.
 * Uses IANA timezone identifiers (e.g., 'America/New_York', 'Europe/London').
 */
export function getWeekday(timezone: string, date: Date = new Date(Date.now())): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  }).format(date);
}

/**
 * Check if the given date is a Monday in the specified timezone.
 */
export function isMonday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Monday';
}

/**
 * Check if the given date is a Tuesday in the specified timezone.
 */
export function isTuesday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Tuesday';
}

/**
 * Check if the given date is a Wednesday in the specified timezone.
 */
export function isWednesday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Wednesday';
}

/**
 * Check if the given date is a Thursday in the specified timezone.
 */
export function isThursday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Thursday';
}

/**
 * Check if the given date is a Friday in the specified timezone.
 */
export function isFriday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Friday';
}

/**
 * Check if the given date is a Saturday in the specified timezone.
 */
export function isSaturday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Saturday';
}

/**
 * Check if the given date is a Sunday in the specified timezone.
 */
export function isSunday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Sunday';
}
