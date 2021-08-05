export function getFixedArray<T>(length: number): T[] {
  const array = new Array<T>();

  array.push = function (...items: T[]): number {
    if (items.length >= length) {
      items.splice(0, items.length - length);
    }

    if (this.length >= length) {
      this.shift();
    }

    return Array.prototype.push.apply(this, items);
  };

  return array;
}
