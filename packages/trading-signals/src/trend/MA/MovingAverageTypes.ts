import type {ALMA} from '../ALMA/ALMA.js';
import type {EMA} from '../EMA/EMA.js';
import type {HMA} from '../HMA/HMA.js';
import type {RMA} from '../RMA/RMA.js';
import type {SMA} from '../SMA/SMA.js';
import type {T3} from '../T3/T3.js';
import type {TRIMA} from '../TRIMA/TRIMA.js';
import type {VIDYA} from '../VIDYA/VIDYA.js';
import type {WMA} from '../WMA/WMA.js';
import type {WSMA} from '../WSMA/WSMA.js';
import type {ZLEMA} from '../ZLEMA/ZLEMA.js';

export type MovingAverageTypes =
  | typeof ALMA
  | typeof EMA
  | typeof HMA
  | typeof RMA
  | typeof SMA
  | typeof T3
  | typeof TRIMA
  | typeof VIDYA
  | typeof WMA
  | typeof WSMA
  | typeof ZLEMA;
