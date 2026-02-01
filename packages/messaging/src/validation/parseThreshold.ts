export interface ParsedThreshold {
  type: 'percent' | 'absolute';
  direction: 'up' | 'down';
  value: number;
}

export function parseThreshold(thresholdStr: string): ParsedThreshold | null {
  const trimmed = thresholdStr.trim();

  // Match patterns: +5%, -10%, +100, -50.5
  const percentMatch = trimmed.match(/^([+-])(\d+(?:\.\d+)?)%$/);
  const absoluteMatch = trimmed.match(/^([+-])(\d+(?:\.\d+)?)$/);

  if (percentMatch) {
    const [, sign, valueStr] = percentMatch;
    return {
      type: 'percent',
      direction: sign === '+' ? 'up' : 'down',
      value: parseFloat(valueStr),
    };
  }

  if (absoluteMatch) {
    const [, sign, valueStr] = absoluteMatch;
    return {
      type: 'absolute',
      direction: sign === '+' ? 'up' : 'down',
      value: parseFloat(valueStr),
    };
  }

  return null;
}
