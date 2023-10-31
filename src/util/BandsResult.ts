import {Big} from '../index.js';

export interface BandsResult {
  lower: Big;
  middle: Big;
  upper: Big;
}

export interface FasterBandsResult {
  lower: number;
  middle: number;
  upper: number;
}
