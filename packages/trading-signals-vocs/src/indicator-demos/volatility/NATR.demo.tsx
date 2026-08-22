import {NATR as NATRClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const NATR: IndicatorConfig = {
  chartTitle: 'NATR (14)',
  color: '#38bdf8',
  createIndicator: () => new NATRClass(14),
  description: 'Normalized Average True Range',
  details:
    'Expresses the ATR as a percentage of the closing price, making volatility comparable across differently priced instruments — a raw $5 ATR is huge for a $50 stock and noise for a $5,000 one.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'natr',
  name: 'NATR',
  processData: makeProcessData({addInputs: ['close', 'high', 'low'], rowInputs: ['close']}),
  requiredInputs: 14,
  type: 'single',
  yAxisLabel: 'NATR (%)',
};
