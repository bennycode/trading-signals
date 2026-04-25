import {AccelerationBands} from './AccelerationBands.demo';
import {ATR} from './ATR.demo';
import {BollingerBands} from './BollingerBands.demo';
import {BollingerBandsWidth} from './BollingerBandsWidth.demo';
import {IQR} from './IQR.demo';
import {MAD} from './MAD.demo';
import {TR} from './TR.demo';
import type {IndicatorConfig} from '../../utils/types';

export const indicators: IndicatorConfig[] = [BollingerBands, AccelerationBands, ATR, TR, BollingerBandsWidth, IQR, MAD];
