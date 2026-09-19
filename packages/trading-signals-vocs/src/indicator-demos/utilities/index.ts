import {addPercentageChangeDemo} from './addPercentageChange.demo';
import {getAverageDemo} from './getAverage.demo';
import {getMaxMinDemo} from './getMaxMin.demo';
import {getMedianDemo} from './getMedian.demo';
import {getPercentageChangeDemo} from './getPercentageChange.demo';
import {getShareDemo} from './getShare.demo';
import {getStandardDeviationDemo} from './getStandardDeviation.demo';
import {otherUtilities} from './otherUtilities';
import type {UtilityConfig} from './types';

export const interactiveUtilities = [
  getAverageDemo,
  getMedianDemo,
  getStandardDeviationDemo,
  getMaxMinDemo,
  getPercentageChangeDemo,
  addPercentageChangeDemo,
  getShareDemo,
] as const;

export const utilities: UtilityConfig[] = [...interactiveUtilities, ...otherUtilities];
