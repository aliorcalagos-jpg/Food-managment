import { describe, expect, it } from "vitest";
import { createLocalDb } from "./localdb";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const tick = () => new Promise((r) => setTimeout(r, 5));

describe("the on-device database", () => {
  it("stores, reads back and deletes documents, and tells watchers", async () => {
    const storage = memory();
    const db = createLocalDb(storage);
    const seen: string[][] = [];
    db.collection("recipes").onSnapshot((s) => seen.push(s.docs.map((d) => d.id)));
    await tick();
    await db.collection("recipes").doc("b").set({ title: "B" });
    await db.collection("recipes").doc("a").set({ title: "A" });
    await tick();
    expect(seen.at(-1)).toEqual(["a", "b"]);
    await db.collection("recipes").doc("a").delete();
    await tick();
    expect(seen.at(-1)).toEqual(["b"]);
  });
  it("keeps data between sessions and keeps collections apart", async () => {
    const storage = memory();
    await createLocalDb(storage).collection("lists").doc("l1").set({ name: "Market" });
    const again = createLocalDb(storage);
    let docs: { id: string; data: Record<string, unknown> | undefined }[] = [];
    again.collection("lists").onSnapshot((s) => (docs = s.docs.map((d) => ({ id: d.id, data: d.data() }))));
    let other = -1;
    again.collection("recipes").onSnapshot((s) => (other = s.docs.length));
    await tick();
    expect(docs).toEqual([{ id: "l1", data: { name: "Market" } }]);
    expect(other).toBe(0);
  });
  it("hands out copies, so editing a result never edits the stored document", async () => {
    const db = createLocalDb(memory());
    await db.collection("meta").doc("settings").set({ lang: "ar" });
    let doc: Record<string, unknown> | undefined;
    db.collection("meta").onSnapshot((s) => (doc = s.docs[0].data()));
    await tick();
    doc!.lang = "en";
    let again: Record<string, unknown> | undefined;
    db.collection("meta").onSnapshot((s) => (again = s.docs[0].data()));
    await tick();
    expect(again).toEqual({ lang: "ar" });
  });
  it("reports a full device instead of pretending it saved", async () => {
    const db = createLocalDb({ getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } });
    await expect(db.collection("recipes").doc("x").set({ a: 1 })).rejects.toThrow("QuotaExceeded");
  });
});
