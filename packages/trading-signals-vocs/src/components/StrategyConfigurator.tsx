import type {Candle} from '@typedtrader/exchange';
import {strategyDefinitions, type StrategyId} from '../utils/strategySchemas';
import {SchemaReference} from './SchemaReference';

interface StrategyConfiguratorProps {
  selectedStrategy: StrategyId;
  onStrategyChange: (strategyId: StrategyId) => void;
  configJson: string;
  onConfigJsonChange: (json: string) => void;
  validationError: string | null;
  candles: Candle[];
}

export function StrategyConfigurator({
  candles,
  configJson,
  onConfigJsonChange,
  onStrategyChange,
  selectedStrategy,
  validationError,
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
    <div className="demo-card">
      <h3 className="text-sm font-semibold demo-heading mb-3">Strategy</h3>
      <select
        value={selectedStrategy}
        onChange={e => handleStrategyChange(e.target.value)}
        className="w-full px-3 py-2 demo-card demo-text rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
        {strategyDefinitions.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs demo-muted">{definition.description}</p>

      <h4 className="text-sm font-semibold demo-heading mt-4 mb-2">Configuration</h4>
      <textarea
        value={configJson}
        onChange={e => onConfigJsonChange(e.target.value)}
        rows={5}
        spellCheck={false}
        className={`w-full px-3 py-2 demo-card border rounded-md demo-text text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
          validationError ? 'border-red-500' : ''
        }`}
      />
      {validationError && <p className="mt-1 text-xs text-red-500">{validationError}</p>}
      <SchemaReference schema={definition.schema} />
    </div>
  );
}
