import {VWAP as VWAPClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const VWAP: IndicatorConfig = {
  chartTitle: 'VWAP',
  color: '#ef4444',
  createIndicator: () => new VWAPClass(),
  description: 'Volume Weighted Average Price',
  details:
    'Calculates the average price weighted by volume. Used to assess whether trades are being executed at favorable prices.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close', 'volume']}),
  id: 'vwap',
  name: 'VWAP',
  processData: makeProcessData({
    addInputs: ['high', 'low', 'close', 'volume'],
    alwaysStable: true,
    rowInputs: ['close', 'volume'],
  }),
  requiredInputs: 1,
  type: 'single',
  yAxisLabel: 'Price',
};
