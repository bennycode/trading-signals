export function formatDate(isoString: string) {
  const date = new Date(isoString);
  // Fixed locale + UTC timezone prevents SSR/client hydration mismatches in Next.js
  return date.toLocaleString('en-US', {
    hour12: false,
    timeZone: 'UTC',
  });
}
