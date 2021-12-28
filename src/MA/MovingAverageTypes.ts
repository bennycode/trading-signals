import {EMA, FasterEMA} from '../EMA/EMA';
import {FasterWSMA, WSMA} from '../WSMA/WSMA';
import {FasterSMA, SMA} from '../SMA/SMA';

export type SmoothingIndicator = EMA | SMA | WSMA;
export type FasterSmoothingIndicator = FasterEMA | FasterSMA | FasterWSMA;

export type MovingAverageTypes = typeof EMA | typeof SMA | typeof WSMA;
export type FasterMovingAverageTypes = typeof FasterEMA | typeof FasterSMA | typeof FasterWSMA;
