import {EMA} from '../EMA/EMA';
import {WSMA} from '../WSMA/WSMA';
import {SMA} from '../SMA/SMA';
import {SMMA} from '../SMMA/SMMA';

export type MovingAverageTypeContext = typeof EMA | typeof WSMA | typeof SMA | typeof SMMA;
