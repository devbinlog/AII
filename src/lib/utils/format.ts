/**
 * AII — Formatting utilities
 */

/** Format duration in ms to MM:SS or HH:MM:SS */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/** Format large numbers with K/M suffix */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format bytes to human-readable */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ── Display formatting policy ─────────────────────────────────────────────────
// Storage stays ISO 8601 (timestamps) / YYYY-MM-DD (calendar dates); these helpers
// only produce display strings. The locale and time zone are explicit so output
// never depends on the OS/browser and server and client render the same text
// (no hydration mismatch). To localize later, thread a locale through here.

/** MVP UI language. */
export const UI_LOCALE = "en-US";
/** Fixed display time zone (deterministic across server, browser and CI). */
export const DISPLAY_TIME_ZONE = "UTC";

const toDate = (date: string | Date) => (typeof date === "string" ? new Date(date) : date);

/** Format a date for display, e.g. "Nov 18, 2026" (default) or "November 2026". */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
): string {
  return new Intl.DateTimeFormat(UI_LOCALE, { timeZone: DISPLAY_TIME_ZONE, ...options }).format(toDate(date));
}

/** Format a clock time for display, e.g. "02:31 UTC". */
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat(UI_LOCALE, { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }).format(toDate(date));
}

/** Format an integer with grouping, e.g. 12,345. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(UI_LOCALE).format(n);
}

/** Relative time, e.g. "just now", "3 hours ago", "2 weeks ago". */
export function formatRelativeTime(timestamp: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(timestamp).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  const rtf = new Intl.RelativeTimeFormat(UI_LOCALE, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
    ["week", 604800],
    ["month", 2592000],
    ["year", 31536000],
  ];
  let unit = units[0]!;
  for (const u of units) if (abs >= u[1]) unit = u;
  return rtf.format(Math.trunc(seconds / unit[1]), unit[0]);
}
