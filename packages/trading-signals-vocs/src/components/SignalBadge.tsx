import {NotAvailable} from './NotAvailable';

interface SignalBadgeProps {
  signal: string;
}

export function SignalBadge({signal}: SignalBadgeProps) {
  if (signal === 'UNKNOWN') {
    return <NotAvailable />;
  }

  const colorClasses =
    signal === 'BULLISH'
      ? 'bg-green-500/15 text-green-500 border-green-500/40'
      : signal === 'BEARISH'
        ? 'bg-red-500/15 text-red-500 border-red-500/40'
        : signal === 'SIDEWAYS'
          ? 'bg-blue-500/15 text-blue-500 border-blue-500/40'
          : 'bg-slate-500/10 demo-muted demo-divider';

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${colorClasses}`}>
      {signal}
    </span>
  );
}
