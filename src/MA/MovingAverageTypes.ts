import {EMA, FasterEMA} from '../EMA/EMA';
import {FasterWSMA, WSMA} from '../WSMA/WSMA';
import {FasterSMA, SMA} from '../SMA/SMA';

export type MovingAverageTypes = typeof EMA | typeof SMA | typeof WSMA;
export type FasterMovingAverageTypes = typeof FasterEMA | typeof FasterSMA | typeof FasterWSMA;
