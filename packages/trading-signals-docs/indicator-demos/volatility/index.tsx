import {AccelerationBands} from './AccelerationBands.demo';
import {ATR} from './ATR.demo';
import {BollingerBands} from './BollingerBands.demo';
import {BollingerBandsWidth} from './BollingerBandsWidth.demo';
import {CHOP} from './CHOP.demo';
import {CVI} from './CVI.demo';
import {DonchianChannels} from './DonchianChannels.demo';
import {GAPO} from './GAPO.demo';
import {IQR} from './IQR.demo';
import {KeltnerChannels} from './KeltnerChannels.demo';
import {MAD} from './MAD.demo';
import {MassIndex} from './MassIndex.demo';
import {NATR} from './NATR.demo';
import {PercentB} from './PercentB.demo';
import {ProjectionOscillator} from './ProjectionOscillator.demo';
import {TR} from './TR.demo';
import {TTMSqueeze} from './TTMSqueeze.demo';
import {UlcerIndex} from './UlcerIndex.demo';
import type {IndicatorConfig} from '../../utils/types';

export const indicators: IndicatorConfig[] = [
  BollingerBands,
  AccelerationBands,
  DonchianChannels,
  KeltnerChannels,
  ATR,
  NATR,
  TR,
  BollingerBandsWidth,
  PercentB,
  IQR,
  MAD,
  UlcerIndex,
  ProjectionOscillator,
  MassIndex,
  GAPO,
  CVI,
  CHOP,
  TTMSqueeze,
];
