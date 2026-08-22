import {KST as KSTClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const KST: IndicatorConfig = {
  chartTitle: 'KST (10, 15, 20, 30)',
  color: '#e11d48',
  createIndicator: () => new KSTClass(),
  description: 'Know Sure Thing',
  details:
    "Martin Pring's Know Sure Thing blends the smoothed percentage rate of change of four timeframes, weighting the longer ones more heavily. Readings above zero mean bullish momentum confirmed across timeframes, readings below zero mean bearish momentum; zero-line crossings signal momentum shifts.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'kst',
  name: 'KST',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 45,
  type: 'single',
  yAxisLabel: 'KST',
};
