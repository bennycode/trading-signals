import type {IndicatorConfig} from '../utils/types';
import {indicators as momentum} from './momentum';
import {indicators as trend} from './trend';
import {indicators as volatility} from './volatility';
import {indicators as volume} from './volume';

export const categories: Record<string, IndicatorConfig[]> = {
  momentum,
  trend,
  volatility,
  volume,
};

/** Category display metadata, also used by the page generator. */
export const categoryMeta = [
  {id: 'trend', title: 'Trend Indicators'},
  {id: 'momentum', title: 'Momentum Indicators'},
  {id: 'volatility', title: 'Volatility Indicators'},
  {id: 'volume', title: 'Volume Indicators'},
] as const;
