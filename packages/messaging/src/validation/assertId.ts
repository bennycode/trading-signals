/**
 * Parses a string as an integer ID and returns the numeric value.
 * Throws if the value is not a valid integer.
 */
export function assertId(value: string): number {
  const id = parseInt(value.trim(), 10);
  if (isNaN(id)) {
    throw new Error('Invalid ID');
  }
  return id;
}
