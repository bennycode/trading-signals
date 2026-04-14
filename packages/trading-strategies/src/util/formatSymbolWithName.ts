import {AlpacaAPI, AssetClass} from '@typedtrader/exchange';

const DEFAULT_MAX_NAME_LENGTH = 30;

/**
 * Max name length for symbol-with-name columns inside monospace tables sent
 * over Telegram. Tuned so a row like `Apple Inc.… (AAPL)` plus a handful of
 * data columns fits on one line on a typical mobile client (~55-60 chars
 * before wrapping).
 *
 * Reports that render monospace tables should reuse this value via
 * `formatSymbolWithName(symbol, names, TELEGRAM_TABLE_NAME_MAX)` so all
 * tables stay visually consistent and fit in one line.
 */
export const TELEGRAM_TABLE_NAME_MAX = 12;

/**
 * Format a ticker symbol as `Name (SYMBOL)` using the given asset name map.
 * Falls back to the bare symbol if no name is known. Long names are truncated
 * with an ellipsis so tables remain readable.
 */
export function formatSymbolWithName(
  symbol: string,
  names: Map<string, string>,
  maxNameLength: number = DEFAULT_MAX_NAME_LENGTH
): string {
  const name = names.get(symbol);
  if (!name) {
    return symbol;
  }
  const truncated = name.length > maxNameLength ? name.slice(0, maxNameLength - 1) + '…' : name;
  return `${truncated} (${symbol})`;
}

/**
 * Fetch all tradable US equities from Alpaca and build a `symbol → name` map.
 * Returns an empty map on failure so reports still render with bare tickers.
 */
export async function fetchUsEquityNames(api: AlpacaAPI): Promise<Map<string, string>> {
  try {
    const assets = await api.getAssets({asset_class: AssetClass.US_EQUITY});
    const map = new Map<string, string>();
    for (const asset of assets) {
      map.set(asset.symbol, asset.name);
    }
    return map;
  } catch {
    return new Map();
  }
}
