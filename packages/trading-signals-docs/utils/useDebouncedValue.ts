import {useEffect, useState} from 'react';

/**
 * Delays a fast-changing value (e.g. every keystroke in a config field) so expensive work
 * derived from it — like rebuilding a whole interpreter for validation — doesn't run on
 * every intermediate state.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
