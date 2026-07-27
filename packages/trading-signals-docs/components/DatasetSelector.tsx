import {useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import type {Candle} from '@typedtrader/exchange';
import type {MarketRegime} from '@typedtrader/candles';

const REGIME_BADGE: Record<MarketRegime, string> = {
  bear: 'bg-red-500/20 text-red-400',
  bull: 'bg-emerald-500/20 text-emerald-400',
  sideways: 'bg-slate-500/30 text-slate-300',
};

interface Dataset {
  id: string;
  name: string;
  description: string;
  regime: MarketRegime;
}

interface DatasetSelectorProps {
  datasets: Dataset[];
  selectedDataset: string;
  onDatasetChange: (datasetId: string) => void;
  onCustomDataset?: (candles: Candle[], name: string) => void;
  customDatasetName?: string | null;
}

export function DatasetSelector({
  customDatasetName,
  datasets,
  onCustomDataset,
  onDatasetChange,
  selectedDataset,
}: DatasetSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const selectedMeta = datasets.find(ds => ds.id === selectedDataset);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const json = JSON.parse(reader.result as string);
        const {z} = await import('zod');
        const {CandleSchema} = await import('@typedtrader/exchange');
        const result = z.array(CandleSchema).safeParse(json);
        if (!result.success) {
          const issues = result.error.issues.slice(0, 3);
          setUploadError(issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
          return;
        }
        if (result.data.length === 0) {
          setUploadError('File contains no candles');
          return;
        }
        const name = file.name.replace(/\.json$/i, '');
        onCustomDataset?.(result.data, name);
        setUploadError(null);
      } catch {
        setUploadError('Invalid JSON file');
      }
    };
    reader.readAsText(file);

    // Reset so the same file can be re-uploaded
    e.target.value = '';
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Market Condition</h3>
      <select
        data-testid="market-condition-select"
        value={selectedDataset}
        onChange={e => onDatasetChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
        {datasets.map(dataset => (
          <option key={dataset.id} value={dataset.id}>
            {dataset.name}
          </option>
        ))}
        {selectedDataset === 'custom' && <option value="custom">{customDatasetName ?? 'Custom'}</option>}
      </select>
      {selectedMeta && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${REGIME_BADGE[selectedMeta.regime]}`}>
            {selectedMeta.regime}
          </span>
          <p className="text-xs text-slate-400">{selectedMeta.description}</p>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="mt-3 flex items-center justify-center w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-md text-slate-300 text-xs font-medium cursor-pointer transition-colors">
        Upload Candle JSON
      </button>

      {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}

      {selectedDataset === 'custom' && customDatasetName && (
        <p className="mt-2 text-xs text-purple-400">Custom: {customDatasetName}</p>
      )}
    </div>
  );
}
