import {EMA} from '../EMA/EMA';
import {WSMA} from '../WSMA/WSMA';
import {SMA} from '../SMA/SMA';

export type MovingAverageTypeContext = typeof EMA | typeof WSMA | typeof SMA;
