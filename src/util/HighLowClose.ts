import {BigSource} from 'big.js';

export type HighLow = {high: BigSource; low: BigSource};

export type HighLowClose = HighLow & {close: BigSource};

export type OpenHighLowClose = HighLowClose & {open: BigSource};

export type OpenHighLowCloseVolume = OpenHighLowClose & {volume: BigSource};

export type HighLowNumber = {high: number; low: number};

export type HighLowCloseNumber = HighLowNumber & {close: number};

export type OpenHighLowCloseNumber = HighLowCloseNumber & {open: number};

export type OpenHighLowCloseVolumeNumber = OpenHighLowCloseNumber & {volume: number};
