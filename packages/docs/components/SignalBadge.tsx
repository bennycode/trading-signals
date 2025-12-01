interface SignalBadgeProps {
  signal: string;
}

export function SignalBadge({signal}: SignalBadgeProps) {
  const displayText = signal === 'UNKNOWN' ? 'N/A' : signal;
  const colorClasses =
    signal === 'BULLISH'
      ? 'bg-green-900/50 text-green-400 border-green-800'
      : signal === 'BEARISH'
        ? 'bg-red-900/50 text-red-400 border-red-800'
        : signal === 'SIDEWAYS'
          ? 'bg-blue-900/50 text-blue-400 border-blue-800'
          : 'bg-slate-900/50 text-slate-400 border-slate-700';

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${colorClasses}`}>
      {displayText}
    </span>
  );
}
