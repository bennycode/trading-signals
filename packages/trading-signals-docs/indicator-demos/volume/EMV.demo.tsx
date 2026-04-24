import {EMV as EMVClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const EMV: IndicatorConfig = {
  chartTitle: 'Ease of Movement (14)',
  color: '#3b82f6',
  createIndicator: () => new EMVClass(14),
  description: 'Ease of Movement',
  details:
    'Relates price change to volume to assess trend strength. Positive EMV means prices are advancing with ease, negative EMV means prices are declining easily. Uses SMA smoothing.',
  getTableColumns: () => buildTableColumns({inputs: ['close', 'volume']}),
  id: 'emv',
  name: 'EMV',
  processData: makeProcessData({rowInputs: ['close', 'volume'], addInputs: ['close', 'high', 'low', 'volume'], signal: 'required'}),
  requiredInputs: 15,
  type: 'single',
  yAxisLabel: 'EMV',
};
