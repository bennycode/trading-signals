import {EMA, FasterEMA} from '../EMA/EMA.js';
import {FasterWSMA, WSMA} from '../WSMA/WSMA.js';
import {FasterSMA, SMA} from '../SMA/SMA.js';

export type MovingAverageTypes = typeof EMA | typeof SMA | typeof WSMA;
export type FasterMovingAverageTypes = typeof FasterEMA | typeof FasterSMA | typeof FasterWSMA;
