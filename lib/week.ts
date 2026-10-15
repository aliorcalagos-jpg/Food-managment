// All planner dates are calendar dates handled as UTC-midnight Date objects, so
// DST and server/browser timezones can never shift an entry onto another day.
// Weeks start on Monday.

export const toISODate = (d: Date) => d.toISOString().slice(0, 10);

/** Parse "YYYY-MM-DD" into a UTC-midnight Date, or null for anything that isn't a real calendar date. */
export function parseISODate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  // rejects overflow like 2026-02-30, which Date silently rolls into March
  return Number.isNaN(d.getTime()) || toISODate(d) !== s ? null : d;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function startOfWeek(d: Date): Date {
  const midnight = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return addDays(midnight, -((midnight.getUTCDay() + 6) % 7));
}

export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Monday of the week containing `input` (an ISO date string); falls back to the week containing `now`. */
export function resolveWeekStart(input: string | undefined, now: Date = new Date()): Date {
  return startOfWeek((input && parseISODate(input)) || now);
}

export function formatDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatWeekRange(start: Date): string {
  const opts = { month: "short", day: "numeric", timeZone: "UTC" } as const;
  const end = addDays(start, 6);
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

export function formatRange(start: Date, end: Date): string {
  const opts = { month: "short", day: "numeric", timeZone: "UTC" } as const;
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const s = start.toLocaleDateString("en-US", sameYear ? opts : { ...opts, year: "numeric" });
  return `${s} – ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

export const MS_PER_DAY = 86_400_000;
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
