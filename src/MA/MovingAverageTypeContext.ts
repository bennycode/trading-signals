import {EMA} from '../EMA/EMA';
import {SMA} from '../SMA/SMA';
import {SMMA} from '../SMMA/SMMA';

export type MovingAverageTypeContext = typeof EMA | typeof SMA | typeof SMMA;
