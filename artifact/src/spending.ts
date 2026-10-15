// Spending is computed from shopping lists; there is no separate expense log.
// All amounts are whole kobo. A priced, ticked item is "bought" (spent); a priced, unticked item is
// "planned". A list counts towards the Monday-to-Sunday week that contains its shopped-on date.
import { addDays, parseISODate, startOfWeek, toISODate } from "../../lib/week";
import type { ShoppingList } from "./model";

export type Trip = { listId: string; name: string; shoppedOn: string; spent: number; planned: number };

export type WeekSummary = {
  weekStart: string;
  spent: number;
  planned: number;
  /** Bought spending per aisle, biggest first. */
  byAisle: { category: string; spent: number }[];
  /** Bought spending per day, Monday (0) to Sunday (6). */
  byDay: number[];
  /** Lists shopped this week that have any priced item, newest first. */
  trips: Trip[];
};

/** The Monday of the week containing an ISO date, or null if it isn't a real date. */
export function weekOf(dateISO: string): string | null {
  const d = parseISODate(dateISO);
  return d ? toISODate(startOfWeek(d)) : null;
}

export function listTotals(list: ShoppingList): { spent: number; planned: number; unpriced: number } {
  let spent = 0;
  let planned = 0;
  let unpriced = 0;
  for (const i of list.items) {
    if (i.price === null) unpriced++;
    else if (i.checked) spent += i.price;
    else planned += i.price;
  }
  return { spent, planned, unpriced };
}

export function weekSummary(lists: ShoppingList[], weekStart: string): WeekSummary {
  const out: WeekSummary = { weekStart, spent: 0, planned: 0, byAisle: [], byDay: [0, 0, 0, 0, 0, 0, 0], trips: [] };
  const aisles = new Map<string, number>();

  for (const list of lists) {
    if (weekOf(list.shoppedOn) !== weekStart) continue;
    const { spent, planned } = listTotals(list);
    if (spent === 0 && planned === 0) continue;
    out.spent += spent;
    out.planned += planned;
    out.trips.push({ listId: list.id, name: list.name, shoppedOn: list.shoppedOn, spent, planned });

    const day = (parseISODate(list.shoppedOn)!.getUTCDay() + 6) % 7; // Monday = 0
    out.byDay[day] += spent;
    for (const i of list.items) {
      if (i.price !== null && i.checked) aisles.set(i.category ?? "Other", (aisles.get(i.category ?? "Other") ?? 0) + i.price);
    }
  }

  out.byAisle = [...aisles].map(([category, spent]) => ({ category, spent })).sort((a, b) => b.spent - a.spent || a.category.localeCompare(b.category));
  out.trips.sort((a, b) => b.shoppedOn.localeCompare(a.shoppedOn) || a.name.localeCompare(b.name));
  return out;
}

/** The last `n` weeks ending at `endWeek` (a Monday), oldest first, including weeks with no spending. */
export function history(lists: ShoppingList[], endWeek: string, n = 8): { weekStart: string; spent: number; planned: number }[] {
  const end = parseISODate(endWeek);
  if (!end) return [];
  return Array.from({ length: n }, (_, k) => {
    const weekStart = toISODate(addDays(end, -7 * (n - 1 - k)));
    const { spent, planned } = weekSummary(lists, weekStart);
    return { weekStart, spent, planned };
  });
}

/** Mean weekly spend over the weeks that had any, rounded to whole naira (kobo noise helps nobody), or null when none did. */
export function averageSpend(weeks: { spent: number }[]): number | null {
  const active = weeks.filter((w) => w.spent > 0);
  return active.length ? Math.round(active.reduce((sum, w) => sum + w.spent, 0) / active.length / 100) * 100 : null;
}

export type BudgetState = "none" | "ok" | "warn" | "over";
export type BudgetStatus = {
  state: BudgetState;
  /** Budget minus bought spending; negative when over. */
  left: number;
  /** Budget minus bought and planned spending. */
  projectedLeft: number;
  /** Share of the budget already spent, 0-100+ (not clamped). */
  percent: number;
  /** True when what is planned but not yet bought would take the week over budget. */
  projectedOver: boolean;
};

export const WARN_AT = 0.8;

/**
 * "over" once bought spending is above the budget; "warn" from 80% spent, or when the planned items would push the
 * week over; otherwise "ok". No budget (null or 0) gives "none".
 */
export function budgetStatus(spent: number, planned: number, budget: number | null): BudgetStatus {
  if (!budget || budget <= 0) return { state: "none", left: 0, projectedLeft: 0, percent: 0, projectedOver: false };
  const projectedOver = spent + planned > budget;
  const state: BudgetState = spent > budget ? "over" : spent >= budget * WARN_AT || projectedOver ? "warn" : "ok";
  return { state, left: budget - spent, projectedLeft: budget - spent - planned, percent: (spent / budget) * 100, projectedOver };
}
