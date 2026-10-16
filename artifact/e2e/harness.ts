import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

const ROOT = resolve(__dirname, "..");
const ORIGIN = "https://artifact.test";

export type Seed = Record<string, Record<string, unknown>>; // collection -> id -> document

/**
 * Serves the built fragment inside the document skeleton the Artifact tool adds, answers the
 * cdnjs React requests from pinned local copies, and installs an in-memory stand-in for the
 * claude.ai `db` capability. The fake is kept in localStorage so reloads see earlier writes.
 */
export async function openArtifact(page: Page, opts: { noDb?: boolean; seed?: Seed; today?: string; lang?: "en" | "ar" | null; tab?: string | null; fx?: "full" | "calm" | "off" } = {}) {
  const fragment = readFileSync(resolve(ROOT, "dist/meal-planner.html"), "utf8");
  const html = `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${fragment}</body></html>`;

  await page.route(`${ORIGIN}/`, (r) => r.fulfill({ contentType: "text/html", body: html }));
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: readFileSync(resolve(ROOT, "test/vendor/react.production.min.js"), "utf8") }),
  );
  await page.route("https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js", (r) =>
    r.fulfill({ contentType: "text/javascript", body: readFileSync(resolve(ROOT, "test/vendor/react-dom.production.min.js"), "utf8") }),
  );
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "" }));
  // anything else the page tried to load would be blocked by the real CSP
  const blocked: string[] = [];
  await page.route(/^https?:\/\/(?!artifact\.test|cdnjs\.cloudflare\.com|fonts\.googleapis\.com).*/, (r) => {
    blocked.push(r.request().url());
    return r.abort();
  });

  if (opts.today) await page.clock.install({ time: new Date(`${opts.today}T12:00:00`) });

  await page.addInitScript(
    ({ noDb, seed, lang, tab, fx }) => {
      const KEY = "fake-claude-db";
      // the remembered language of this device; only set when nothing is remembered yet, so a switch survives reloads
      if (lang && !localStorage.getItem("meal-planner:lang")) localStorage.setItem("meal-planner:lang", lang);
      // the tab the page opens on; null leaves it unset so the page uses its own default (Expenses)
      if (tab && !localStorage.getItem("meal-planner:tab")) localStorage.setItem("meal-planner:tab", tab);
      // tests run with effects off (steady layouts to measure); the motion tests turn them on
      if (!localStorage.getItem("meal-planner:fx")) localStorage.setItem("meal-planner:fx", fx);
      type Docs = Record<string, Record<string, unknown>>;
      const load = (): Docs => JSON.parse(localStorage.getItem(KEY) || "{}");
      const save = (d: Docs) => localStorage.setItem(KEY, JSON.stringify(d));
      if (seed && !localStorage.getItem(KEY)) save(seed);

      const w = window as unknown as Record<string, unknown>;
      w.__failWrites = false;
      w.__writeDelay = 15; // ms; tests raise it to make quick successive edits overlap
      w.__overlaps = 0;
      w.__writeCount = 0;
      const inflight = new Set<string>();
      const subs: { coll: string; next: (s: unknown) => void }[] = [];

      const snapshot = (coll: string) => {
        const all = load()[coll] || {};
        const docs = Object.keys(all).sort().map((id) => ({ id, exists: true, data: () => JSON.parse(JSON.stringify(all[id])) }));
        return { docs, size: docs.length, empty: docs.length === 0 };
      };
      const notify = (coll: string) => setTimeout(() => subs.filter((s) => s.coll === coll).forEach((s) => s.next(snapshot(coll))), 0);

      const write = async (coll: string, id: string, apply: (d: Docs) => void) => {
        const key = `${coll}/${id}`;
        if (inflight.has(key)) (w.__overlaps as number)++;
        inflight.add(key);
        try {
          await new Promise((r) => setTimeout(r, w.__writeDelay as number));
          if (w.__failWrites) throw { code: "unavailable", message: "network down" };
          const d = load();
          apply(d);
          save(d);
          (w.__writeCount as number)++;
          notify(coll);
        } finally {
          inflight.delete(key);
        }
      };

      const db = {
        collection(coll: string) {
          return {
            doc(id = crypto.randomUUID()) {
              return {
                id,
                set: (data: unknown) => write(coll, id, (d) => ((d[coll] ||= {})[id] = JSON.parse(JSON.stringify(data)))),
                delete: () => write(coll, id, (d) => void delete d[coll]?.[id]),
              };
            },
            onSnapshot(next: (s: unknown) => void) {
              const sub = { coll, next };
              subs.push(sub);
              setTimeout(() => next(snapshot(coll)), 0);
              return () => void subs.splice(subs.indexOf(sub), 1);
            },
          };
        },
      };
      w.claude = { use: async (name: string) => (name === "db" && !noDb ? db : null) };
    },
    { noDb: !!opts.noDb, seed: opts.seed ?? null, lang: opts.lang === undefined ? "en" : opts.lang, tab: opts.tab === undefined ? "recipes" : opts.tab, fx: opts.fx ?? "off" },
  );

  await page.goto(`${ORIGIN}/`);
  return { blocked };
}

export const stored = (page: Page, coll: string) =>
  page.evaluate((c) => Object.values(JSON.parse(localStorage.getItem("fake-claude-db") || "{}")[c] ?? {}) as Record<string, unknown>[], coll);

type SeedItem = { name: string; price: number | null; checked: boolean; category?: string };
/** A seeded shopping list. Prices are whole kobo (₦1 = 100). */
export function seedList(id: string, shoppedOn: string, items: SeedItem[], name = id) {
  return {
    [id]: {
      name, rangeStart: null, rangeEnd: null, createdAt: `${shoppedOn}T08:00:00Z`, shoppedOn,
      items: items.map((i, n) => ({ id: `${id}-${n}`, name: i.name, quantity: 1, unit: "", category: i.category ?? "Pantry", checked: i.checked, price: i.price })),
    },
  };
}
