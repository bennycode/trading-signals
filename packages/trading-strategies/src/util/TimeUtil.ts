export function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function findLastTradingDay(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 2);
  else if (day === 6) d.setDate(d.getDate() - 1);
  return d;
}

export function findFirstTradingDay(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1);
  else if (day === 6) d.setDate(d.getDate() + 2);
  return d;
}
