import type {EMA} from '../EMA/EMA.js';
import type {RMA} from '../RMA/RMA.js';
import type {SMA} from '../SMA/SMA.js';
import type {WMA} from '../WMA/WMA.js';
import type {WSMA} from '../WSMA/WSMA.js';

export type MovingAverageTypes = typeof EMA | typeof RMA | typeof SMA | typeof WMA | typeof WSMA;
