interface Indicator {
  id: string;
  name: string;
  description: string;
}

interface IndicatorListProps {
  indicators: Indicator[];
  selectedIndicator: string;
  onIndicatorChange: (indicatorId: string) => void;
}

export function IndicatorList({indicators, selectedIndicator, onIndicatorChange}: IndicatorListProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-white mb-4">Momentum Indicators</h2>
      <nav className="space-y-1">
        {indicators.map(indicator => (
          <button
            key={indicator.id}
            onClick={() => onIndicatorChange(indicator.id)}
            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
              selectedIndicator === indicator.id
                ? 'bg-purple-600 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
            }`}>
            <div className="font-medium">{indicator.name}</div>
            <div className="text-xs opacity-75">{indicator.description}</div>
          </button>
        ))}
      </nav>
    </div>
  );
}
