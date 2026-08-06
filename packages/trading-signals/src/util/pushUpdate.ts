type PushUpdateOptions<T> = {
  array: T[];
  item: T;
  maxLength: number;
  replace: boolean;
};

/**
 * Adds an item to the array or replaces the last item in the array.
 * If the array limit size is exceeded, the oldest array element will be removed and returned by the function.
 */
export function pushUpdate<T>({array, item, maxLength, replace}: PushUpdateOptions<T>) {
  if (array.length > 0 && replace === true) {
    array[array.length - 1] = item;
  } else {
    array.push(item);
  }

  if (array.length > maxLength) {
    return array.shift();
  }

  return null;
}
