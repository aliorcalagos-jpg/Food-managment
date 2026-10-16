// A small database kept in the phone itself, with the same shape as the claude.ai `db` capability. The Android app
// uses it (there is no claude.ai account to ask), so dishes, weeks, lists and settings live on the device and the app
// works fully offline. Everything is one JSON document in localStorage; a few hundred kilobytes is plenty for one person.
import type { CollectionRef, Db, DocSnap, QuerySnap } from "./runtime";

const KEY = "meal-planner:data";
type Data = Record<string, Record<string, Record<string, unknown>>>;

export function createLocalDb(storage: Pick<Storage, "getItem" | "setItem"> = localStorage): Db {
  const read = (): Data => {
    try {
      return JSON.parse(storage.getItem(KEY) || "{}") as Data;
    } catch {
      return {};
    }
  };
  const write = (d: Data) => storage.setItem(KEY, JSON.stringify(d)); // throws when the device is out of space
  const subs: { name: string; next: (s: QuerySnap) => void }[] = [];

  const snapshot = (name: string): QuerySnap => {
    const all = read()[name] ?? {};
    return {
      docs: Object.keys(all)
        .sort()
        .map((id): DocSnap => ({ id, exists: true, data: () => structuredClone(all[id]) })),
    };
  };
  // snapshots arrive after the write that caused them, like the real database
  const notify = (name: string) => queueMicrotask(() => subs.filter((s) => s.name === name).forEach((s) => s.next(snapshot(name))));

  return {
    collection(name: string): CollectionRef {
      return {
        doc: (id = crypto.randomUUID()) => ({
          async set(data) {
            const d = read();
            (d[name] ??= {})[id] = structuredClone(data);
            write(d);
            notify(name);
          },
          async delete() {
            const d = read();
            if (d[name]) delete d[name][id];
            write(d);
            notify(name);
          },
        }),
        onSnapshot(next) {
          const sub = { name, next };
          subs.push(sub);
          setTimeout(() => next(snapshot(name)), 0);
          return () => {
            const i = subs.indexOf(sub);
            if (i >= 0) subs.splice(i, 1);
          };
        },
      };
    },
  };
}
