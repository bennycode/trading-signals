/**
 * Adds an item to the array or replaces the last item in the array.
 */
export function pushUpdate<T>(array: T[], replace: boolean, item: T) {
  if (array.length > 0 && replace === true) {
    array[array.length - 1] = item;
  } else {
    array.push(item);
  }

  return item;
}
