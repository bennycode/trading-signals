import {useEffect, useState} from 'react';

/**
 * Syncs a selected `id` from a list of items with the URL hash.
 *
 * - On mount, picks up an existing hash (e.g. `#rsi`) if it matches an item.
 * - Listens for `hashchange` so back/forward and external links keep state in sync.
 * - The returned `select` setter writes the new id back to the hash.
 */
export function useHashSelection<T extends {id: string}>(items: readonly T[], fallbackId: string) {
  const [selectedId, setSelectedId] = useState<string>(fallbackId);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash && items.some(item => item.id === hash)) {
        setSelectedId(hash);
      }
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [items]);

  const select = (id: string) => {
    setSelectedId(id);
    window.location.hash = id;
  };

  return [selectedId, select] as const;
}
