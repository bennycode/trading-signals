import type {EMA, FasterEMA} from '../EMA/EMA.js';
import type {FasterWSMA, WSMA} from '../WSMA/WSMA.js';
import type {FasterSMA, SMA} from '../SMA/SMA.js';
import type {FasterWMA, WMA} from '../WMA/WMA.js';

export type MovingAverageTypes = typeof EMA | typeof SMA | typeof WMA | typeof WSMA;
export type FasterMovingAverageTypes = typeof FasterEMA | typeof FasterSMA | typeof FasterWMA | typeof FasterWSMA;
