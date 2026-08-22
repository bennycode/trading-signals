import {FRAMA as FRAMAClass} from 'trading-signals';
import {makeProcessData} from '../../utils/processData';
import {buildTableColumns} from '../../utils/tableColumns';
import type {IndicatorConfig} from '../../utils/types';

export const FRAMA: IndicatorConfig = {
  chartTitle: 'FRAMA (16)',
  color: '#0ea5e9',
  createIndicator: () => new FRAMAClass(16),
  description: 'Fractal Adaptive Moving Average',
  details:
    'Measures the fractal dimension of the price curve over the interval and adapts its smoothing accordingly: it hugs prices almost one-to-one when they travel in a straight line and turns as sluggish as a 200-period average in dense congestion, flattening out whipsaws.',
  getTableColumns: indicator => buildTableColumns({indicator, inputs: ['close']}),
  id: 'frama',
  name: 'FRAMA',
  processData: makeProcessData({rowInputs: ['close']}),
  requiredInputs: 16,
  type: 'single',
  yAxisLabel: 'Price',
};
