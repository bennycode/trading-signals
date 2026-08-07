import {BollingerBands, BollingerBandsWidth as BollingerBandsWidthClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const BollingerBandsWidth: IndicatorConfig = {
  chartTitle: 'BBW (20, 2)',
  color: '#10b981',
  createIndicator: () => new BollingerBandsWidthClass(new BollingerBands(20, 2)),
  description: 'Bollinger Bands Width',
  details:
    'Measures the width between the upper and lower Bollinger Bands relative to the middle band. Useful for identifying squeezes and potential breakouts.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'bbw',
  name: 'BBW',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 20,
  type: 'single',
  yAxisLabel: 'BBW',
};
