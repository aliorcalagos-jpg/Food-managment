import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aisleLabel, itemText, TABLES, translate, unitLabel, unitSuggestions } from "./i18n";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translation tables", () => {
  it("have the same keys, none empty", () => {
    expect(Object.keys(TABLES.ar).sort()).toEqual(Object.keys(TABLES.en).sort());
    for (const lang of ["en", "ar"] as const) {
      for (const [key, text] of Object.entries(TABLES[lang])) expect(text.trim(), `${lang}:${key}`).not.toBe("");
    }
  });

  it("use the same placeholders in both languages", () => {
    for (const key of Object.keys(TABLES.en) as (keyof typeof TABLES.en)[]) {
      expect(placeholders(TABLES.ar[key]), key).toEqual(placeholders(TABLES.en[key]));
    }
  });

  it("really are Arabic in the Arabic table (apart from a few shared symbols and brand names)", () => {
    const shared = new Set(["phQty", "switchTo", "approx", "pilotName"]);
    for (const [key, text] of Object.entries(TABLES.ar)) {
      if (!shared.has(key)) expect(text, key).toMatch(/[؀-ۿ]/);
    }
  });
});

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(f) && !/\.test\.|i18n\.ts$/.test(f) ? [readFileSync(p, "utf8")] : [];
  });

describe("translation keys", () => {
  it("are all used somewhere (a key nobody shows is dead text to translate)", () => {
    const code = sources(__dirname).join("\n");
    // aisle and unit names are looked up by a built key ("aisle:Produce"), so they are not written out in code
    const dynamic = /^(aisle|unit):/;
    const unused = Object.keys(TABLES.en).filter((k) => !dynamic.test(k) && !new RegExp(`["'\`]${k}["'\`]`).test(code));
    expect(unused).toEqual([]);
  });
});

describe("translate", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(translate("en", "progress", { done: 2, total: 5 })).toBe("2 of 5 done");
    expect(translate("ar", "progress", { done: 2, total: 5 })).toBe("تم: 2 من 5");
    expect(translate("en", "progress", { done: 2 })).toBe("2 of {total} done");
  });
});

describe("display helpers", () => {
  it("shows canonical units in Arabic and passes anything else through as typed", () => {
    expect(unitLabel("ar", "kg")).toBe("كيلو");
    expect(unitLabel("ar", "cup")).toBe("كوب");
    expect(unitLabel("ar", "bunch")).toBe("bunch");
    expect(unitLabel("en", "kg")).toBe("kg");
    expect(unitSuggestions("ar")).toContain("كوب");
  });
  it("translates aisles and keeps unknown ones as stored", () => {
    expect(aisleLabel("ar", "Produce")).toBe("الخضار والفاكهة");
    expect(aisleLabel("ar", "Mystery")).toBe("Mystery");
  });
  it("formats an item with Western digits and fractions in both languages", () => {
    expect(itemText("ar", 1.5, "cup", "أرز")).toBe("1 1/2 كوب أرز");
    expect(itemText("en", 3, "", "tomatoes")).toBe("3 tomatoes");
  });
});
