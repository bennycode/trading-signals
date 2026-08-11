/**
 * Compound Annual Growth Rate, in percent: the constant yearly return that turns the begin value
 * into the end value over the given number of years. Smooths lumpy multi-year performance into a
 * single figure that compares across investments and horizons.
 *
 * @throws If a value is non-positive or the duration is not a positive number of years.
 */
export function getCAGR(beginValue: number, endValue: number, years: number) {
  if (beginValue <= 0 || endValue <= 0) {
    throw new Error(`The begin and end values have to be positive, but "${beginValue}" and "${endValue}" were given.`);
  }

  if (!Number.isFinite(years) || years <= 0) {
    throw new Error(`The years have to be a positive number, but "${years}" was given.`);
  }

  return ((endValue / beginValue) ** (1 / years) - 1) * 100;
}
