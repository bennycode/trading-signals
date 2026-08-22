import {useRef, useState} from 'react';
import type {ChangeEvent} from 'react';
import type {Candle} from '@typedtrader/exchange/schemas';
import type {MarketRegime} from '@typedtrader/candles';

const REGIME_BADGE: Record<MarketRegime, string> = {
  bear: 'bg-red-500/15 text-red-500',
  bull: 'bg-emerald-500/15 text-emerald-500',
  sideways: 'bg-slate-500/15 demo-muted',
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
        if (typeof reader.result !== 'string') {
          setUploadError('Invalid JSON file');
          return;
        }
        const json: unknown = JSON.parse(reader.result);
        const {z} = await import('zod');
        // The `/schemas` subpath is browser-safe; the package barrel would pull broker code using Node.js built-ins.
        const {CandleSchema} = await import('@typedtrader/exchange/schemas');
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

  const pillClass = (isSelected: boolean) =>
    `px-3 py-1.5 rounded-md border border-(--demo-accent) text-[13px] cursor-pointer transition-colors ${
      isSelected ? 'bg-(--demo-accent) text-white' : 'bg-transparent demo-text hover:bg-(--demo-accent)/10'
    }`;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {datasets.map(dataset => (
          <button
            key={dataset.id}
            data-testid={`dataset-${dataset.id}`}
            type="button"
            onClick={() => onDatasetChange(dataset.id)}
            className={pillClass(dataset.id === selectedDataset)}>
            {dataset.name}
          </button>
        ))}
        {customDatasetName && (
          <button
            data-testid="dataset-custom"
            type="button"
            onClick={() => onDatasetChange('custom')}
            className={pillClass(selectedDataset === 'custom')}>
            {customDatasetName}
          </button>
        )}
        {onCustomDataset && (
          <>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-md border border-dashed demo-divider demo-muted text-[13px] cursor-pointer transition-colors hover:bg-(--demo-accent)/10">
              Upload Candle JSON
            </button>
          </>
        )}
      </div>
      {selectedMeta && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${REGIME_BADGE[selectedMeta.regime]}`}>
            {selectedMeta.regime}
          </span>
          <p className="text-xs demo-muted">{selectedMeta.description}</p>
        </div>
      )}
      {uploadError && <p className="mt-2 text-xs text-red-500">{uploadError}</p>}
    </div>
  );
}
