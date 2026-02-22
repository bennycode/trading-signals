import type {ExchangeCandle} from '@typedtrader/exchange';
import {strategyDefinitions, type StrategyId} from '../utils/strategySchemas';

interface StrategyConfiguratorProps {
  selectedStrategy: StrategyId;
  onStrategyChange: (strategyId: StrategyId) => void;
  configJson: string;
  onConfigJsonChange: (json: string) => void;
  validationError: string | null;
  candles: ExchangeCandle[];
}

export function StrategyConfigurator({
  selectedStrategy,
  onStrategyChange,
  configJson,
  onConfigJsonChange,
  validationError,
  candles,
}: StrategyConfiguratorProps) {
  const definition = strategyDefinitions.find(s => s.id === selectedStrategy)!;

  const handleStrategyChange = (id: string) => {
    const newId = id as StrategyId;
    onStrategyChange(newId);
    const newDef = strategyDefinitions.find(s => s.id === newId)!;
    const defaults = newDef.getDefaultConfig(candles);
    onConfigJsonChange(JSON.stringify(defaults, null, 2));
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Strategy</h3>
      <select
        value={selectedStrategy}
        onChange={e => handleStrategyChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
        {strategyDefinitions.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-slate-400">{definition.description}</p>

      <h4 className="text-sm font-semibold text-white mt-4 mb-2">Configuration</h4>
      <textarea
        value={configJson}
        onChange={e => onConfigJsonChange(e.target.value)}
        rows={5}
        spellCheck={false}
        className={`w-full px-3 py-2 bg-slate-900 border rounded-md text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
          validationError ? 'border-red-500' : 'border-slate-600'
        }`}
      />
      {validationError && <p className="mt-1 text-xs text-red-400">{validationError}</p>}
    </div>
  );
}
