// Pilot: the step-by-step guide behind the floating button. This file is only the rules (which steps there are, when
// each is done, what to point at, what to suggest); it knows nothing about the page. The UI reads facts from the
// store and from what is on screen, and calls these functions. Pilot never changes data.

export type PilotTab = "week" | "recipes" | "lists" | "expenses";

/** Everything the rules look at. */
export type Facts = {
  tab: PilotTab;
  /** Saved foods, and how many of them have at least one ingredient. */
  foods: number;
  foodsWithIngredients: number;
  /** Foods picked for the current week, and how many of those have no ingredients yet. */
  picks: number;
  pickedBare: number;
  /** Whether this week's shopping list exists, how many lines it has, how many are ticked or priced. */
  weekList: boolean;
  items: number;
  ticked: number;
  priced: number;
  /** A weekly budget has been set. */
  budget: boolean;
  /** What is on screen right now. */
  ui: {
    formOpen: boolean; // the new / edit food screen
    titleTyped: boolean;
    sheetOpen: boolean; // the ingredient sheet
    nameFilled: boolean; // something is typed or picked in the sheet
    addEnabled: boolean; // the sheet's Add button can be pressed (a name and a quantity)
    ingredientRows: number; // ingredients already in the food form
    listOpen: boolean; // a shopping list is open
  };
};

/** What the person had when the guide started, for steps that mean "more than before". */
export type Baseline = { foodsWithIngredients: number };

export type Step = {
  id: string;
  titleKey: string;
  bodyKey: string;
  /** Anchors (`data-pilot` values) to point at, best first; the first one on screen is used. */
  targets: string[];
  /** Done by the facts, or (ack) when the person presses "Got it". */
  done?: (f: Facts, base: Baseline) => boolean;
  ack?: boolean;
  /** The step only exists when this is true. */
  when?: (f: Facts) => boolean;
};

export type Workflow = { id: WorkflowId; titleKey: string; subKey: string; steps: Step[] };
export type WorkflowId = "dish" | "week" | "shop" | "spend";

const WORKFLOWS: Workflow[] = [
  {
    id: "dish",
    titleKey: "pwDish",
    subKey: "pwDishSub",
    steps: [
      { id: "foods-tab", titleKey: "pd1T", bodyKey: "pd1B", targets: ["nav-recipes"], done: (f) => f.tab === "recipes" || f.ui.formOpen },
      { id: "new-food", titleKey: "pd2T", bodyKey: "pd2B", targets: ["new-food", "nav-recipes"], done: (f) => f.ui.formOpen },
      { id: "name", titleKey: "pd3T", bodyKey: "pd3B", targets: ["food-title"], done: (f) => f.ui.titleTyped },
      { id: "open-sheet", titleKey: "pd4T", bodyKey: "pd4B", targets: ["add-ingredient"], done: (f) => f.ui.sheetOpen || f.ui.ingredientRows > 0 },
      { id: "pick", titleKey: "pd5T", bodyKey: "pd5B", targets: ["catalog", "sheet-input", "add-ingredient"], done: (f) => f.ui.nameFilled || f.ui.ingredientRows > 0 },
      { id: "quantity", titleKey: "pd6T", bodyKey: "pd6B", targets: ["qty-chips", "sheet-input", "add-ingredient"], done: (f) => f.ui.addEnabled || f.ui.ingredientRows > 0 },
      { id: "add", titleKey: "pd7T", bodyKey: "pd7B", targets: ["sheet-add", "add-ingredient"], done: (f) => f.ui.ingredientRows > 0 },
      { id: "close-sheet", titleKey: "pd8T", bodyKey: "pd8B", targets: ["sheet-done", "add-ingredient"], done: (f) => !f.ui.sheetOpen && f.ui.ingredientRows > 0 },
      { id: "save", titleKey: "pd9T", bodyKey: "pd9B", targets: ["save-food"], done: (f, b) => f.foodsWithIngredients > b.foodsWithIngredients },
    ],
  },
  {
    id: "week",
    titleKey: "pwWeek",
    subKey: "pwWeekSub",
    steps: [
      { id: "week-tab", titleKey: "pw1T", bodyKey: "pw1B", targets: ["nav-week"], done: (f) => f.tab === "week" },
      { id: "need-foods", titleKey: "pw0T", bodyKey: "pw0B", targets: ["new-food", "nav-recipes"], done: (f) => f.foods > 0, when: (f) => f.foods === 0 },
      { id: "pick-food", titleKey: "pw2T", bodyKey: "pw2B", targets: ["pick-card", "nav-week"], done: (f) => f.picks > 0 },
      { id: "fix-bare", titleKey: "pw3T", bodyKey: "pw3B", targets: ["add-ing-cta"], done: (f) => f.pickedBare === 0, when: (f) => f.pickedBare > 0 },
      { id: "servings", titleKey: "pw4T", bodyKey: "pw4B", targets: ["stepper", "pick-card"], ack: true },
      { id: "buy", titleKey: "pw5T", bodyKey: "pw5B", targets: ["buy-panel"], ack: true },
      { id: "open-list", titleKey: "pw6T", bodyKey: "pw6B", targets: ["open-list-btn", "buy-panel"], done: (f) => f.ui.listOpen },
    ],
  },
  {
    id: "shop",
    titleKey: "pwShop",
    subKey: "pwShopSub",
    steps: [
      { id: "need-list", titleKey: "ps0T", bodyKey: "ps0B", targets: ["pick-card", "nav-week"], done: (f) => f.weekList, when: (f) => !f.weekList },
      { id: "lists-tab", titleKey: "ps1T", bodyKey: "ps1B", targets: ["nav-lists"], done: (f) => f.tab === "lists" },
      { id: "open", titleKey: "ps2T", bodyKey: "ps2B", targets: ["list-card", "nav-lists"], done: (f) => f.ui.listOpen },
      { id: "tick", titleKey: "ps3T", bodyKey: "ps3B", targets: ["tick", "list-card"], done: (f) => f.ticked > 0 },
      { id: "price", titleKey: "ps4T", bodyKey: "ps4B", targets: ["price", "list-card"], done: (f) => f.priced > 0 },
      { id: "total", titleKey: "ps5T", bodyKey: "ps5B", targets: ["trip-bar"], ack: true },
      { id: "swipe", titleKey: "ps6T", bodyKey: "ps6B", targets: ["tick"], ack: true },
    ],
  },
  {
    id: "spend",
    titleKey: "pwSpend",
    subKey: "pwSpendSub",
    steps: [
      { id: "spend-tab", titleKey: "pp1T", bodyKey: "pp1B", targets: ["nav-expenses"], done: (f) => f.tab === "expenses" },
      { id: "budget", titleKey: "pp2T", bodyKey: "pp2B", targets: ["budget-input", "settings-summary"], done: (f) => f.budget },
      { id: "currency", titleKey: "pp3T", bodyKey: "pp3B", targets: ["currency", "settings-summary"], ack: true },
      { id: "read", titleKey: "pp4T", bodyKey: "pp4B", targets: ["hero", "settings-summary"], ack: true },
    ],
  },
];

export const workflows = (): Workflow[] => WORKFLOWS;
export const workflow = (id: WorkflowId): Workflow => WORKFLOWS.find((w) => w.id === id)!;

/** The steps that apply to these facts (some only exist in some situations). */
export const stepsFor = (w: Workflow, f: Facts): Step[] => w.steps.filter((s) => !s.when || s.when(f));

/**
 * Steps already finished. Once a step is finished it stays finished for this run (closing the sheet after adding
 * an ingredient must not send you back to "open the sheet"); new ones are added as the facts show them done.
 */
export function advance(w: Workflow, f: Facts, base: Baseline, done: ReadonlySet<string>): Set<string> {
  const next = new Set(done);
  for (const s of stepsFor(w, f)) if (s.done && !next.has(s.id) && s.done(f, base)) next.add(s.id);
  return next;
}

/** The step to show now: the first applicable one that is not finished. */
export function currentStep(w: Workflow, f: Facts, done: ReadonlySet<string>): Step | null {
  return stepsFor(w, f).find((s) => !done.has(s.id)) ?? null;
}

export function progress(w: Workflow, f: Facts, done: ReadonlySet<string>): { done: number; total: number } {
  const steps = stepsFor(w, f);
  return { done: steps.filter((s) => done.has(s.id)).length, total: steps.length };
}

/** The guide that fits what the person has (or has not) done yet. */
export function suggestWorkflow(f: Facts): WorkflowId {
  if (f.foodsWithIngredients === 0) return "dish";
  if (f.picks === 0) return "week";
  if (f.weekList && f.ticked === 0) return "shop";
  if (!f.budget) return "spend";
  return "week";
}

export const emptyFacts = (): Facts => ({
  tab: "week",
  foods: 0,
  foodsWithIngredients: 0,
  picks: 0,
  pickedBare: 0,
  weekList: false,
  items: 0,
  ticked: 0,
  priced: 0,
  budget: false,
  ui: { formOpen: false, titleTyped: false, sheetOpen: false, nameFilled: false, addEnabled: false, ingredientRows: 0, listOpen: false },
});
