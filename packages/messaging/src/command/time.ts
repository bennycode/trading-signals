import moment from 'moment';
import 'moment-timezone';

export const time = async () => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const currentTime = moment().tz(timeZone);
  const reply = [
    `Running in: ${timeZone}`,
    `Local time: ${currentTime.format()}`,
    `UTC time: ${currentTime.utc().format()}`,
  ];
  return reply.join('\n');
};
