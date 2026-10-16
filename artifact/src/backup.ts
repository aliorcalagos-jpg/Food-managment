// Export and import of everything the app keeps: dishes, weeks, shopping lists and settings, as one JSON file.
// Pure (no db, no DOM): the store applies the plan this builds.
import { fromSettings, toList, toRecipe, toSettings, toWeekPlan, type Recipe, type Settings, type ShoppingList, type WeekPlan } from "./model";

export const BACKUP_APP = "meal-planner";
export const BACKUP_VERSION = 1;

type Doc = Record<string, unknown>;
export type CollectionName = "recipes" | "week" | "lists" | "meta";
export type Backup = {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: { recipes: Record<string, Doc>; week: Record<string, Doc>; lists: Record<string, Doc>; meta: Record<string, Doc> };
};
export type Everything = { recipes: Recipe[]; weeks: WeekPlan[]; lists: ShoppingList[]; settings: Settings };

const withoutId = <T extends { id: string }>(x: T): Doc => {
  const { id: _id, ...rest } = x;
  void _id;
  return rest as unknown as Doc;
};

export function buildBackup(all: Everything, now = new Date()): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data: {
      recipes: Object.fromEntries(all.recipes.map((r) => [r.id, withoutId(r)])),
      week: Object.fromEntries(all.weeks.map((w) => [w.weekStart, { picks: w.picks, listId: w.listId }])),
      lists: Object.fromEntries(all.lists.map((l) => [l.id, withoutId(l)])),
      meta: { settings: fromSettings(all.settings) },
    },
  };
}

export const backupFileName = (now = new Date()) => `meal-planner-${now.toISOString().slice(0, 10)}.json`;

export type ParseResult = { ok: true; backup: Backup; counts: Counts } | { ok: false; error: "notJson" | "notBackup" | "tooNew" };
export type Counts = { recipes: number; weeks: number; lists: number };

const isObj = (v: unknown): v is Doc => !!v && typeof v === "object" && !Array.isArray(v);

/** Reads a backup file. Every document is passed through the same readers the app uses, so a damaged one cannot break the app. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "notJson" };
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP || !isObj(raw.data) || typeof raw.version !== "number") return { ok: false, error: "notBackup" };
  if (raw.version > BACKUP_VERSION) return { ok: false, error: "tooNew" };
  const d = raw.data;
  const docs = (v: unknown): Record<string, Doc> => (isObj(v) ? Object.fromEntries(Object.entries(v).filter((e): e is [string, Doc] => isObj(e[1]))) : {});
  const recipes = Object.fromEntries(Object.entries(docs(d.recipes)).map(([id, x]) => [id, withoutId(toRecipe(id, x))]));
  const week = Object.fromEntries(Object.entries(docs(d.week)).map(([id, x]) => [id, (({ picks, listId }) => ({ picks, listId }))(toWeekPlan(id, x))]));
  const lists = Object.fromEntries(Object.entries(docs(d.lists)).map(([id, x]) => [id, withoutId(toList(id, x))]));
  const meta: Record<string, Doc> = isObj(d.meta) && isObj(d.meta.settings) ? { settings: fromSettings(toSettings(d.meta.settings)) } : {};
  const backup: Backup = {
    app: BACKUP_APP,
    version: raw.version,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
    data: { recipes, week, lists, meta },
  };
  return { ok: true, backup, counts: { recipes: Object.keys(recipes).length, weeks: Object.keys(week).length, lists: Object.keys(lists).length } };
}

export type ImportOp = { name: CollectionName; id: string; data: Doc | null };
export type ImportMode = "merge" | "replace";

/**
 * The writes that bring the phone in line with a backup. Merge keeps everything on the phone and adds or replaces
 * what the file has (by id). Replace also deletes what the file does not have. The device's own language is never changed.
 */
export function planImport(backup: Backup, current: Everything, mode: ImportMode): ImportOp[] {
  const ops: ImportOp[] = [];
  const put = (name: CollectionName, docs: Record<string, Doc>, existing: string[]) => {
    for (const [id, data] of Object.entries(docs)) ops.push({ name, id, data });
    if (mode === "replace") for (const id of existing) if (!(id in docs)) ops.push({ name, id, data: null });
  };
  put("recipes", backup.data.recipes, current.recipes.map((r) => r.id));
  put("week", backup.data.week, current.weeks.map((w) => w.weekStart));
  put("lists", backup.data.lists, current.lists.map((l) => l.id));
  const s = backup.data.meta.settings;
  if (s) {
    const { lang: _lang, ...rest } = s;
    void _lang;
    ops.push({ name: "meta", id: "settings", data: fromSettings({ ...toSettings(rest), lang: current.settings.lang }) });
  }
  return ops;
}

// ---- when did you last back up? (kept per device) ----

export const LAST_BACKUP_KEY = "meal-planner:last-backup";
export const BACKUP_NUDGE_DAYS = 14;

export function daysSince(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}
