export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  // Fixed locale + UTC timezone prevents SSR/client hydration mismatches in Next.js
  return date.toLocaleString('en-US', {
    timeZone: 'UTC',
    hour12: false,
  });
}
