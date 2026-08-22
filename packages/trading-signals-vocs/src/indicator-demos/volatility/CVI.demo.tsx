import {CVI as CVIClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const CVI: IndicatorConfig = {
  chartTitle: 'Chaikin Volatility (10)',
  color: '#0ea5e9',
  createIndicator: () => new CVIClass(10),
  description: 'Chaikin Volatility',
  details:
    'Smooths the candle range (high minus low) and reports how much that smoothed range has grown or shrunk over the lookback, in percent. Positive readings mean volatility is expanding, negative readings a calming market, so a zero-cross flags a volatility regime change. Marc Chaikin reads it together with price direction: a volatility spike while prices fall often marks panic selling near a bottom, while fading volatility during rising prices points to a maturing uptrend.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['high', 'low']}),
  id: 'cvi',
  name: 'Chaikin Volatility',
  processData: makeProcessData({rowInputs: ['high', 'low']}),
  requiredInputs: 20,
  type: 'single',
  yAxisLabel: 'CVI',
};
