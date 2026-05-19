/**
 * Calculates the percentage share that `amount` represents of `total`.
 *
 * For example, a share of 25 out of 100 yields 25 (= 25%).
 *
 * @param amount The portion to express as a share.
 * @param total The whole that the share is taken from.
 * @returns The percentage share. `100` means "100%".
 * @throws If `total` is `0`, because the share is undefined.
 */
export function getShare(amount: number, total: number): number {
  if (total === 0) {
    throw new Error('Cannot calculate share of a total of "0".');
  }

  return (amount / total) * 100;
}
