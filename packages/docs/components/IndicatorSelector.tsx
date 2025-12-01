interface IndicatorSelectorProps {
  indicators: Array<{id: string; name: string; description: string}>;
  selectedId: string;
  onSelect: (id: string) => void;
}

export function IndicatorSelector({indicators, selectedId, onSelect}: IndicatorSelectorProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold text-white mb-3">Select Indicator</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {indicators.map(indicator => (
          <button
            key={indicator.id}
            onClick={() => onSelect(indicator.id)}
            className={`p-3 rounded-lg text-left transition-all ${
              selectedId === indicator.id
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-700/50 text-slate-300 border-slate-600 hover:bg-slate-700 hover:border-slate-500'
            } border`}>
            <div className="font-semibold">{indicator.name}</div>
            <div className="text-xs opacity-75 mt-1">{indicator.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
