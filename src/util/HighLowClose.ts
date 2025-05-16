import type {BigSource} from 'big.js';

export type HighLow<T = BigSource> = {
  high: T;
  low: T;
};

export type HighLowClose<T = BigSource> = HighLow<T> & {
  close: T;
};

export type OpenHighLowClose<T = BigSource> = HighLowClose<T> & {
  open: T;
};

export type HighLowCloseVolume<T = BigSource> = HighLowClose<T> & {
  volume: T;
};

export type OpenHighLowCloseVolume<T = BigSource> = OpenHighLowClose<T> & {
  volume: T;
};

export type HighLowNumber = HighLow<number>;
export type HighLowCloseNumber = HighLowClose<number>;
export type OpenHighLowCloseNumber = OpenHighLowClose<number>;
export type OpenHighLowCloseVolumeNumber = OpenHighLowCloseVolume<number>;
