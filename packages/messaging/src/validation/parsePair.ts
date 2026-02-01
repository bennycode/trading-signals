import {CurrencyPair} from '@typedtrader/exchange';

export function parsePair(pairStr: string): CurrencyPair | null {
  const commaIndex = pairStr.indexOf(',');
  if (commaIndex === -1) {
    return null;
  }
  const base = pairStr.slice(0, commaIndex);
  const counter = pairStr.slice(commaIndex + 1);
  return new CurrencyPair(base, counter);
}
