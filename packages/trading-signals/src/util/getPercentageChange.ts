/**
 * Calculates the percentage change between two values.
 *
 * A positive result indicates an increase, a negative result indicates a decrease.
 * For example, going from 100 to 125 yields 25 (= +25%), going from 100 to 75 yields -25.
 *
 * @param baseValue The starting / reference value.
 * @param newValue The value to compare against the base.
 * @returns The percentage change. `100` means "100%".
 * @throws If `baseValue` is `0`, because the percentage change is undefined.
 */
export function getPercentageChange(baseValue: number, newValue: number) {
  if (baseValue === 0) {
    throw new Error('Cannot calculate percentage change from a base value of "0".');
  }

  return ((newValue - baseValue) / baseValue) * 100;
}
