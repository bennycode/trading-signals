import {useEffect, useState} from 'react';

function getLocalTime(hour: number, minute: number): string {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', {timeZone: 'America/New_York'});
  const et = new Date(etStr);
  et.setHours(hour, minute, 0, 0);

  const diff = et.getTime() - new Date(etStr).getTime();
  const local = new Date(now.getTime() + diff);

  return local.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hour12: false});
}

function isMarketOpen(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', {timeZone: 'America/New_York'}));
  const day = et.getDay();
  if (day === 0 || day === 6) {
    return false;
  }
  const minutes = et.getHours() * 60 + et.getMinutes();
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export function MarketClock() {
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOpeningTime(getLocalTime(9, 30));
    setClosingTime(getLocalTime(16, 0));
    setOpen(isMarketOpen());
    setReady(true);
    const interval = setInterval(() => setOpen(isMarketOpen()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <div className="text-center">
      <p className="text-slate-400 flex items-center justify-center gap-2">
        Nasdaq trading hours today*: <span className="text-white font-mono">{openingTime} - {closingTime}</span> your local time
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${open ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {open ? 'Open' : 'Closed'}
        </span>
      </p>
      <p className="text-xs text-slate-500 mt-1">*Public holidays may affect trading hours</p>
    </div>
  );
}
