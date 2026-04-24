import {BollingerBands, BollingerBandsWidth as BollingerBandsWidthClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const BollingerBandsWidth: IndicatorConfig = {
  id: 'bbw',
  name: 'BBW',
  description: 'Bollinger Bands Width',
  color: '#10b981',
  type: 'single',
  requiredInputs: 20,
  details:
    'Measures the width between the upper and lower Bollinger Bands relative to the middle band. Useful for identifying squeezes and potential breakouts.',
  createIndicator: () => new BollingerBandsWidthClass(new BollingerBands(20, 2)),
  processData: makeProcessData({rowInputs: ['close']}),
  getTableColumns: indicator => buildTableColumns({inputs: ['close'], indicator}),
  chartTitle: 'BBW (20, 2)',
  yAxisLabel: 'BBW',
};
