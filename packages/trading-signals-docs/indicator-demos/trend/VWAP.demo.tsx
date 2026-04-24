import {VWAP as VWAPClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const VWAP: IndicatorConfig = {
  id: 'vwap',
  name: 'VWAP',
  description: 'Volume Weighted Average Price',
  color: '#ef4444',
  type: 'single',
  requiredInputs: 1,
  details:
    'Calculates the average price weighted by volume. Used to assess whether trades are being executed at favorable prices.',
  createIndicator: () => new VWAPClass(),
  processData: makeProcessData({rowInputs: ['close', 'volume'], addInputs: ['high', 'low', 'close', 'volume'], signal: 'optional', alwaysStable: true}),
  getTableColumns: () => buildTableColumns({inputs: ['close', 'volume']}),
  chartTitle: 'VWAP',
  yAxisLabel: 'Price',
};
