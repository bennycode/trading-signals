export function getDateString(date: Date) {
  return date.toISOString().split('T')[0];
}
