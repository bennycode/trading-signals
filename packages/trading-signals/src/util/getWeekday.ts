/**
 * Get the weekday name for a given date in a specific timezone.
 * Uses IANA timezone identifiers (e.g., 'America/New_York', 'Europe/London').
 */
function getWeekday(timezone: string, date: Date = new Date(Date.now())): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  }).format(date);
}

export function isMonday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Monday';
}

export function isTuesday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Tuesday';
}

export function isWednesday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Wednesday';
}

export function isThursday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Thursday';
}

export function isFriday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Friday';
}

export function isSaturday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Saturday';
}

export function isSunday(timezone: string, date: Date = new Date(Date.now())): boolean {
  return getWeekday(timezone, date) === 'Sunday';
}
