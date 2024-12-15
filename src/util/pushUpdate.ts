export function pushUpdate<T>(array: T[], replace: boolean, update: T) {
  if (array.length && replace) {
    array[array.length - 1] = update;
  } else {
    array.push(update);
  }
}
