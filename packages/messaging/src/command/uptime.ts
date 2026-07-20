const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_WEEK = 604_800;
const SECONDS_PER_YEAR = 31_536_000;

const getUptime = () => {
  const totalSeconds = Math.floor(process.uptime());
  const duration: Partial<Record<Intl.DurationFormatUnit, number>> = {
    days: Math.floor((totalSeconds % SECONDS_PER_WEEK) / SECONDS_PER_DAY),
    hours: Math.floor((totalSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    minutes: Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds: totalSeconds % SECONDS_PER_MINUTE,
    weeks: Math.floor((totalSeconds % SECONDS_PER_YEAR) / SECONDS_PER_WEEK),
    years: Math.floor(totalSeconds / SECONDS_PER_YEAR),
  };
  return new Intl.DurationFormat('en', {secondsDisplay: 'always', style: 'long'}).format(duration);
};

export const uptime = async () => {
  return `Running since: ${getUptime()}`;
};
