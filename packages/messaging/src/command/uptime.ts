import moment from 'moment';
import momentDurationFormatSetup from 'moment-duration-format';
momentDurationFormatSetup(moment);

const getUptime = () => {
  const seconds = Math.floor(process.uptime());
  return moment.duration(seconds, 'seconds').format({
    precision: 0,
    template: 'y [years], w [weeks], d [days], h [hours], m [minutes], s [seconds]',
  });
};

export default async () => {
  return `Running since: ${getUptime()}`;
};
