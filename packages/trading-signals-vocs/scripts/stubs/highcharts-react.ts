/**
 * Runtime stub for `@highcharts/react`, mapped in via `scripts/tsconfig.json` paths.
 *
 * The page generator only reads metadata (id, name, description, details) from the demo
 * registry, but importing the registry transitively imports `@highcharts/react`, which needs a
 * DOM at import time and uses extensionless ES module imports Node cannot resolve. Type-only
 * imports (ChartOptions etc.) are erased at compile time, so components are all that is needed.
 */
export function Chart() {
  return null;
}
