export type HighLow<T = number> = {
  high: T;
  low: T;
};

export type HighLowClose<T = number> = HighLow<T> & {
  close: T;
};

export type OpenHighLowClose<T = number> = HighLowClose<T> & {
  open: T;
};

export type OpenHighLowCloseVolume<T = number> = OpenHighLowClose<T> & {
  volume: T;
};

export type HighLowCloseVolume<T = number> = Omit<OpenHighLowCloseVolume<T>, 'open'>;
