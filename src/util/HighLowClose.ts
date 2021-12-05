import {BigSource} from 'big.js';

export type HighLow = {high: BigSource; low: BigSource};

export type HighLowClose = HighLow & {close: BigSource};

export type HighLowNumber = {high: number; low: number};

export type HighLowCloseNumber = HighLowNumber & {close: number};
