import { describe, expect, it } from "vitest";
import { TABLES } from "./i18n";
import { advance, currentStep, emptyFacts, progress, stepsFor, suggestWorkflow, workflow, workflows, type Facts } from "./pilot";

const facts = (patch: Partial<Facts> & { ui?: Partial<Facts["ui"]> } = {}): Facts => {
  const base = emptyFacts();
  return { ...base, ...patch, ui: { ...base.ui, ...patch.ui } };
};
const none = { foodsWithIngredients: 0 };

describe("the guides", () => {
  it("have text in both languages and something to point at for every step", () => {
    for (const w of workflows()) {
      for (const key of [w.titleKey, w.subKey, ...w.steps.flatMap((s) => [s.titleKey, s.bodyKey])]) {
        expect(TABLES.en[key as keyof typeof TABLES.en], `en ${key}`).toBeTruthy();
        expect(TABLES.ar[key as keyof typeof TABLES.ar], `ar ${key}`).toBeTruthy();
      }
      for (const s of w.steps) {
        expect(s.targets.length, s.id).toBeGreaterThan(0);
        expect(Boolean(s.done) !== Boolean(s.ack), `${s.id} is either detected or acknowledged`).toBe(true);
      }
      expect(new Set(w.steps.map((s) => s.id)).size).toBe(w.steps.length);
    }
  });
  it("can be finished: every detected step can become done", () => {
    const everything = facts({
      tab: "expenses",
      foods: 2,
      foodsWithIngredients: 2,
      picks: 2,
      weekList: true,
      items: 4,
      ticked: 1,
      priced: 1,
      budget: true,
      ui: { formOpen: true, titleTyped: true, sheetOpen: false, nameFilled: true, addEnabled: true, ingredientRows: 2, listOpen: true },
    });
    const tabs = ["week", "recipes", "lists", "expenses"] as const;
    for (const w of workflows()) for (const s of w.steps) if (s.done) expect(tabs.some((tab) => s.done!({ ...everything, tab }, none)), s.id).toBe(true);
  });
});

describe("add a dish", () => {
  const w = workflow("dish");
  it("starts at the Foods tab on an empty app and follows what is done", () => {
    let done = new Set<string>();
    expect(currentStep(w, facts({ tab: "week" }), done)?.id).toBe("foods-tab");
    let f = facts({ tab: "recipes" });
    done = advance(w, f, none, done);
    expect(currentStep(w, f, done)?.id).toBe("new-food");
    f = facts({ tab: "recipes", ui: { formOpen: true } as never });
    done = advance(w, f, none, done);
    expect(currentStep(w, f, done)?.id).toBe("name");
    f = facts({ tab: "recipes", ui: { formOpen: true, titleTyped: true, sheetOpen: true } as never });
    done = advance(w, f, none, done);
    expect(currentStep(w, f, done)?.id).toBe("pick");
    f = facts({ tab: "recipes", ui: { formOpen: true, titleTyped: true, sheetOpen: true, nameFilled: true } as never });
    done = advance(w, f, none, done);
    expect(currentStep(w, f, done)?.id).toBe("quantity");
    f = facts({ tab: "recipes", ui: { formOpen: true, titleTyped: true, sheetOpen: true, nameFilled: true, addEnabled: true } as never });
    done = advance(w, f, none, done);
    expect(currentStep(w, f, done)?.id).toBe("add");
    f = facts({ tab: "recipes", ui: { formOpen: true, titleTyped: true, sheetOpen: true, ingredientRows: 1 } as never });
    done = advance(w, f, none, done);
    expect(currentStep(w, f, done)?.id).toBe("close-sheet");
    f = facts({ tab: "recipes", ui: { formOpen: true, titleTyped: true, sheetOpen: false, ingredientRows: 1 } as never });
    done = advance(w, f, none, done);
    expect(currentStep(w, f, done)?.id).toBe("save");
    f = facts({ tab: "recipes", foods: 1, foodsWithIngredients: 1 });
    done = advance(w, f, none, done);
    expect(currentStep(w, f, done)).toBeNull();
    expect(progress(w, f, done)).toEqual({ done: 9, total: 9 });
  });
  it("never goes back: closing the sheet or the form does not undo finished steps", () => {
    const opened = advance(w, facts({ tab: "recipes", ui: { formOpen: true, titleTyped: true, sheetOpen: true } as never }), none, new Set());
    const done = advance(w, facts({ tab: "recipes" }), none, opened); // everything closed again
    expect(done.has("new-food")).toBe(true);
    expect(done.has("open-sheet")).toBe(true);
  });
  it("counts a dish as saved only when there is one more than when the guide began", () => {
    const base = { foodsWithIngredients: 3 };
    expect(advance(w, facts({ foodsWithIngredients: 3 }), base, new Set()).has("save")).toBe(false);
    expect(advance(w, facts({ foodsWithIngredients: 4 }), base, new Set()).has("save")).toBe(true);
  });
  it("skips ahead when the facts already show later steps (ingredients already added)", () => {
    const done = advance(w, facts({ tab: "recipes", ui: { formOpen: true, titleTyped: true, ingredientRows: 2 } as never }), none, new Set());
    expect(["open-sheet", "pick", "quantity", "add"].every((id) => done.has(id))).toBe(true);
  });
});

describe("plan the week", () => {
  const w = workflow("week");
  it("asks for a food first when there are none, and for ingredients when a picked food has none", () => {
    expect(stepsFor(w, facts()).map((s) => s.id)).toContain("need-foods");
    expect(stepsFor(w, facts({ foods: 3 })).map((s) => s.id)).not.toContain("need-foods");
    expect(stepsFor(w, facts({ foods: 3 })).map((s) => s.id)).not.toContain("fix-bare");
    expect(stepsFor(w, facts({ foods: 3, picks: 1, pickedBare: 1 })).map((s) => s.id)).toContain("fix-bare");
  });
  it("moves on as foods are picked and stops at the acknowledgement steps until they are acknowledged", () => {
    const f = facts({ tab: "week", foods: 2, picks: 1, weekList: true });
    const done = advance(w, f, none, new Set());
    expect(currentStep(w, f, done)?.id).toBe("servings");
    done.add("servings");
    expect(currentStep(w, f, done)?.id).toBe("buy");
    done.add("buy");
    expect(currentStep(w, f, done)?.id).toBe("open-list");
  });
});

describe("shop and spend", () => {
  it("shopping waits for a list, then follows ticks and prices", () => {
    const w = workflow("shop");
    expect(currentStep(w, facts({ tab: "lists" }), new Set())?.id).toBe("need-list");
    const f = facts({ tab: "lists", weekList: true, items: 3, ui: { listOpen: true } as never });
    let done = advance(w, f, none, new Set());
    expect(currentStep(w, f, done)?.id).toBe("tick");
    done = advance(w, { ...f, ticked: 1 }, none, done);
    expect(currentStep(w, { ...f, ticked: 1 }, done)?.id).toBe("price");
  });
  it("spending follows the budget", () => {
    const w = workflow("spend");
    let done = advance(w, facts({ tab: "expenses" }), none, new Set());
    expect(currentStep(w, facts({ tab: "expenses" }), done)?.id).toBe("budget");
    done = advance(w, facts({ tab: "expenses", budget: true }), none, done);
    expect(currentStep(w, facts({ tab: "expenses", budget: true }), done)?.id).toBe("currency");
  });
});

describe("suggestWorkflow", () => {
  it("suggests the guide that fits what the person has", () => {
    expect(suggestWorkflow(facts())).toBe("dish");
    expect(suggestWorkflow(facts({ foods: 2, foodsWithIngredients: 2 }))).toBe("week");
    expect(suggestWorkflow(facts({ foods: 2, foodsWithIngredients: 2, picks: 1, weekList: true }))).toBe("shop");
    expect(suggestWorkflow(facts({ foods: 2, foodsWithIngredients: 2, picks: 1, weekList: true, ticked: 1 }))).toBe("spend");
    expect(suggestWorkflow(facts({ foods: 2, foodsWithIngredients: 2, picks: 1, weekList: true, ticked: 1, budget: true }))).toBe("week");
  });
});
