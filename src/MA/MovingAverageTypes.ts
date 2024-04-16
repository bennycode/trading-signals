import type {EMA, FasterEMA} from '../EMA/EMA.js';
import type {FasterWSMA, WSMA} from '../WSMA/WSMA.js';
import type {FasterSMA, SMA} from '../SMA/SMA.js';

export type MovingAverageTypes = typeof EMA | typeof SMA | typeof WSMA;
export type FasterMovingAverageTypes = typeof FasterEMA | typeof FasterSMA | typeof FasterWSMA;
