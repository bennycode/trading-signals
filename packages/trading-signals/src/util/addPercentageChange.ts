/**
 * Applies a percentage change to a base value.
 *
 * For example, adding 25 to a base of 100 yields 125 (= +25%),
 * adding -10 to a base of 200 yields 180 (= -10%).
 *
 * @param baseValue The value to apply the percentage to.
 * @param percentage The percentage to apply. `25` means "25%".
 * @returns The base value with the percentage applied.
 */
export function addPercentageChange(baseValue: number, percentage: number): number {
  return baseValue * (1 + percentage / 100);
}
