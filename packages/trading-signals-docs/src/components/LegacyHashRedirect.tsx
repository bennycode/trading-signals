'use client';

import {useEffect} from 'react';

/**
 * The previous docs site showed each category on one page and addressed indicators by hash, e.g.
 * `/indicators/trend/#ema`. Links like that still exist, so the category page forwards them to the
 * indicator's own page. Only known ids are forwarded; anything else stays on the overview.
 */
export function LegacyHashRedirect({category, ids}: {category: string; ids: string[]}) {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (ids.includes(id)) {
      window.location.replace(`/indicators/${category}/${id}`);
    }
  }, [category, ids]);

  return null;
}
