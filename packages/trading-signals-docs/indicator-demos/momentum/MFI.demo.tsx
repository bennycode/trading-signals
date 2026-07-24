import {MFI as MFIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const MFI: IndicatorConfig = {
  chartTitle: 'MFI (14)',
  color: '#10b981',
  createIndicator: () => new MFIClass(14),
  description: 'Money Flow Index',
  details:
    "A volume-weighted RSI: each candle's typical price is weighted by trading volume, so moves backed by heavy volume shift the index more than moves on thin volume. Values above 80 indicate overbought, below 20 indicate oversold.",
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close', 'volume']}),
  id: 'mfi',
  name: 'MFI',
  processData: makeProcessData({addInputs: ['close', 'high', 'low', 'volume'], rowInputs: ['close', 'volume']}),
  requiredInputs: 15,
  type: 'single',
  yAxisLabel: 'MFI',
};
