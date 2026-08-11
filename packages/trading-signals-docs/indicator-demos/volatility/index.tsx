import {AccelerationBands} from './AccelerationBands.demo';
import {ATR} from './ATR.demo';
import {BollingerBands} from './BollingerBands.demo';
import {BollingerBandsWidth} from './BollingerBandsWidth.demo';
import {DonchianChannels} from './DonchianChannels.demo';
import {IQR} from './IQR.demo';
import {KeltnerChannels} from './KeltnerChannels.demo';
import {MAD} from './MAD.demo';
import {NATR} from './NATR.demo';
import {TR} from './TR.demo';
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
  IQR,
  MAD,
  UlcerIndex,
];
