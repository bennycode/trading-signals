import type {EMA} from '../EMA/EMA.js';
import type {HMA} from '../HMA/HMA.js';
import type {RMA} from '../RMA/RMA.js';
import type {SMA} from '../SMA/SMA.js';
import type {TRIMA} from '../TRIMA/TRIMA.js';
import type {WMA} from '../WMA/WMA.js';
import type {WSMA} from '../WSMA/WSMA.js';

export type MovingAverageTypes =
  | typeof EMA
  | typeof HMA
  | typeof RMA
  | typeof SMA
  | typeof TRIMA
  | typeof WMA
  | typeof WSMA;
