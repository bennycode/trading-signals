/**
 * `true` when series A traded at or below series B on the previous reading and now trades above
 * it — the moment a golden cross fires when A is a fast moving average and B a slow one. Feed it
 * the previous and current readings of both series.
 */
export function hasCrossedOver(previousA: number, previousB: number, currentA: number, currentB: number) {
  return previousA <= previousB && currentA > currentB;
}
