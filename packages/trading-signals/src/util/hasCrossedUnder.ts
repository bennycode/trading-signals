/**
 * `true` when series A traded at or above series B on the previous reading and now trades below
 * it — the moment a death cross fires when A is a fast moving average and B a slow one. Feed it
 * the previous and current readings of both series.
 */
export function hasCrossedUnder(previousA: number, previousB: number, currentA: number, currentB: number) {
  return previousA >= previousB && currentA < currentB;
}
