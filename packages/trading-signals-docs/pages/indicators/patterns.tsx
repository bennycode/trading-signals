import {useState} from 'react';
import {DatasetSelector} from '../../components/DatasetSelector';
import {IndicatorList} from '../../components/IndicatorList';
import {useHashSelection} from '../../hooks/useHashSelection';
import {indicators} from '../../indicator-demos/patterns';
import {datasets} from '../../utils/datasets';
import {renderSingleIndicator} from '../../utils/renderUtils';

export default function PatternIndicators() {
  const [selectedIndicator, selectIndicator] = useHashSelection(indicators, 'bullish-engulfing');
  const [selectedDataset, setSelectedDataset] = useState<string>('uptrend');

  const renderIndicatorContent = () => {
    const config = indicators.find(ind => ind.id === selectedIndicator);
    const dataset = datasets.find(ds => ds.id === selectedDataset);
    if (!config || !dataset) {
      return null;
    }

    if (config.type === 'single') {
      return renderSingleIndicator(config, dataset.candles);
    }

    return config.customRender(config, dataset.candles);
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 shrink-0">
        <div className="sticky top-6 space-y-4">
          <DatasetSelector datasets={datasets} selectedDataset={selectedDataset} onDatasetChange={setSelectedDataset} />
          <IndicatorList
            indicators={indicators}
            selectedIndicator={selectedIndicator}
            onIndicatorChange={selectIndicator}
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">{renderIndicatorContent()}</main>
    </div>
  );
}
