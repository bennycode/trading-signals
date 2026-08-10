import {ForceIndex as ForceIndexClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const ForceIndex: IndicatorConfig = {
  chartTitle: 'Force Index (13)',
  color: '#0ea5e9',
  createIndicator: () => new ForceIndexClass(),
  description: 'Force Index',
  details:
    "Dr. Alexander Elder's Force Index combines the direction of a price change, its extent, and the volume behind it into a single measure of the power of buyers or sellers, smoothed with a 13-period EMA. Readings above zero indicate buying pressure, below zero selling pressure.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close', 'volume']}),
  id: 'force-index',
  name: 'ForceIndex',
  processData: makeProcessData({addInputs: ['close', 'high', 'low', 'volume'], rowInputs: ['close', 'volume']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'FI',
};
