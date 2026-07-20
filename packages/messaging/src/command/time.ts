/** Formats a date as ISO 8601 with a UTC offset (e.g. `2026-07-20T14:30:00+02:00`) in the given time zone. */
const formatInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    timeZoneName: 'longOffset',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPart['type']) => parts.find(part => part.type === type)?.value ?? '';
  // "longOffset" yields "GMT+02:00", or just "GMT" when the offset is zero.
  const offset = get('timeZoneName').replace('GMT', '') || '+00:00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`;
};

export const time = async () => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new Date();
  const reply = [
    `Running in: ${timeZone}`,
    `Local time: ${formatInTimeZone(now, timeZone)}`,
    `UTC time: ${formatInTimeZone(now, 'UTC')}`,
  ];
  return reply.join('\n');
};
