import {DPO as DPOClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const DPO: IndicatorConfig = {
  chartTitle: 'DPO (20)',
  color: '#f472b6',
  createIndicator: () => new DPOClass(20),
  description: 'Detrended Price Oscillator',
  details:
    'Strips the prevailing trend by comparing a displaced close against its surrounding average, exposing the short-term price cycle. Above zero the cycle trades above the average (bullish pressure), below zero beneath it (bearish pressure). Each reading describes the bar half an interval plus one bar back, not the latest candle.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'dpo',
  name: 'DPO',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 20,
  type: 'single',
  yAxisLabel: 'DPO',
};
