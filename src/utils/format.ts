/** Returns a human-readable duration string, e.g. "1 minute 23 seconds" */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0 || parts.length === 0)
    parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

  return parts.join(' ');
}

/** Returns a Discord timestamp string formatted as absolute date/time. */
export function discordTimestamp(date: Date): string {
  return `<t:${Math.floor(date.getTime() / 1_000)}:F>`;
}

/** Returns UTC string like "2026-05-30 14:05 UTC" */
export function utcTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
}
