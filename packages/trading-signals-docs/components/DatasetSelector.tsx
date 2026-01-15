interface Dataset {
  id: string;
  name: string;
  description: string;
}

interface DatasetSelectorProps {
  datasets: Dataset[];
  selectedDataset: string;
  onDatasetChange: (datasetId: string) => void;
}

export function DatasetSelector({datasets, selectedDataset, onDatasetChange}: DatasetSelectorProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Market Condition</h3>
      <select
        value={selectedDataset}
        onChange={e => onDatasetChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
        {datasets.map(dataset => (
          <option key={dataset.id} value={dataset.id}>
            {dataset.name}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-slate-400">{datasets.find(ds => ds.id === selectedDataset)?.description}</p>
    </div>
  );
}
