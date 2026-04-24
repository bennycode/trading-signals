import {ADX} from './ADX.demo';
import {BreakoutBarLow} from './BreakoutBarLow.demo';
import {DEMA} from './DEMA.demo';
import {DMA} from './DMA.demo';
import {DX} from './DX.demo';
import {EMA} from './EMA.demo';
import {HigherLowTrail} from './HigherLowTrail.demo';
import {LinearRegression} from './LinearRegression.demo';
import {PSAR} from './PSAR.demo';
import {RMA} from './RMA.demo';
import {SMA} from './SMA.demo';
import {SMA15} from './SMA15.demo';
import {SwingHigh} from './SwingHigh.demo';
import {SwingLow} from './SwingLow.demo';
import {VWAP} from './VWAP.demo';
import {WMA} from './WMA.demo';
import {WSMA} from './WSMA.demo';
import {ZigZag} from './ZigZag.demo';
import type {IndicatorConfig} from '../../utils/types';

export const indicators: IndicatorConfig[] = [
  SMA,
  EMA,
  DEMA,
  WMA,
  RMA,
  WSMA,
  VWAP,
  ADX,
  DX,
  PSAR,
  DMA,
  LinearRegression,
  SMA15,
  ZigZag,
  SwingLow,
  SwingHigh,
  HigherLowTrail,
  BreakoutBarLow,
];
