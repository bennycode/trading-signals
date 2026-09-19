'use client';

import {useEffect, useState} from 'react';
import type {Candle} from '@typedtrader/exchange/schemas';
import {categories} from '../indicator-demos/registry';
import {datasets} from '../utils/datasets';
import {buildSingleIndicatorView} from '../utils/renderUtils';
import {DatasetSelector} from './DatasetSelector';

interface CustomDataset {
  candles: Candle[];
  name: string;
}

export function IndicatorPageDemo({category, id}: {category: string; id: string}) {
  const [isMounted, setIsMounted] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState('uptrend');
  const [customDataset, setCustomDataset] = useState<CustomDataset | null>(null);

  // Highcharts touches `window`, so the demo only renders after hydration.
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleCustomDataset = (candles: Candle[], name: string) => {
    setCustomDataset({candles, name});
    setSelectedDataset('custom');
  };

  const config = categories[category]?.find(indicator => indicator.id === id);
  const candles =
    selectedDataset === 'custom'
      ? customDataset?.candles
      : datasets.find(candidate => candidate.id === selectedDataset)?.candles;

  if (!isMounted) {
    return <div style={{minHeight: 600}} />;
  }

  if (!config || !candles) {
    return (
      <p>
        Unknown indicator: {category}/{id}
      </p>
    );
  }

  const selector = (
    <DatasetSelector
      datasets={datasets}
      selectedDataset={selectedDataset}
      onDatasetChange={setSelectedDataset}
      onCustomDataset={handleCustomDataset}
      customDatasetName={customDataset?.name}
    />
  );

  if (config.type !== 'single') {
    return (
      <div className="not-prose space-y-6">
        <div className="demo-card">{selector}</div>
        {config.customRender(config, candles)}
      </div>
    );
  }

  const {chart, priceChart, table} = buildSingleIndicatorView(config, candles);

  return (
    <div className="not-prose space-y-6">
      <div className="demo-card space-y-4">
        {selector}
        {chart}
      </div>
      {priceChart}
      {table}
    </div>
  );
}
