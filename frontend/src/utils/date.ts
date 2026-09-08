/**
 * utils/date.ts
 * Reliable UTC date parsing and formatting utilities.
 * Prevents timezone offset bugs (e.g. naive UTC string parsed as local time).
 */

export function parseUtcDate(input?: string | number | Date | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);

  const str = String(input).trim();
  if (!str) return new Date();

  // If already contains Z or +/- offset, standard parser works in UTC
  if (str.endsWith('Z') || /[+-]\d{2}(:\d{2})?$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  // Otherwise, append 'Z' to treat naive ISO string as UTC
  const normalized = str.includes('T') ? `${str}Z` : `${str.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date(str) : d;
}

export function formatTimeAgo(input?: string | number | Date | null): string {
  const d = parseUtcDate(input);
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - d.getTime()) / 1000));

  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
