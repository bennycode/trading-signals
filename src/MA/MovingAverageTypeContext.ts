import {EMA} from '../EMA/EMA';
import {RMA} from '../RMA/RMA';
import {SMA} from '../SMA/SMA';
import {SMMA} from '../SMMA/SMMA';

export type MovingAverageTypeContext = typeof EMA | typeof RMA | typeof SMA | typeof SMMA;
