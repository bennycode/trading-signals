import type {FasterEMA} from '../EMA/EMA.js';
import type {FasterRMA} from '../RMA/RMA.js';
import type {FasterSMA} from '../SMA/SMA.js';
import type {FasterWMA} from '../WMA/WMA.js';
import type {FasterWSMA} from '../WSMA/WSMA.js';

export type FasterMovingAverageTypes =
  | typeof FasterEMA
  | typeof FasterRMA
  | typeof FasterSMA
  | typeof FasterWMA
  | typeof FasterWSMA;
