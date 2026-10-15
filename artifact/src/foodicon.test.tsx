import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CATALOG, SHAPES } from "../../lib/catalog";
import { FoodIcon, SHAPE_DRAWINGS } from "./ui/FoodIcon";

describe("ingredient pictures", () => {
  it("has a drawing for every shape the list uses, and none left over", () => {
    expect(Object.keys(SHAPE_DRAWINGS).sort()).toEqual([...SHAPES].sort());
    for (const i of CATALOG) expect(SHAPE_DRAWINGS[i.look.shape], i.en).toBeTypeOf("function");
  });
  it("draws every ingredient as a decorative svg with the item's own colour", () => {
    for (const i of CATALOG) {
      const svg = renderToStaticMarkup(<FoodIcon look={i.look} />);
      expect(svg, i.en).toContain('aria-hidden="true"');
      expect(svg, i.en).toContain("<svg");
      expect(svg.toLowerCase(), i.en).toContain(i.look.color.toLowerCase());
      expect(svg, i.en).not.toMatch(/NaN|undefined/);
    }
  });
  it("tells shapes apart: no two shapes draw the same thing in the same colour", () => {
    const seen = new Map<string, string>();
    for (const s of SHAPES) {
      const svg = renderToStaticMarkup(<FoodIcon look={{ shape: s, color: "#336699" }} />);
      expect(seen.get(svg), `${s} looks like ${seen.get(svg)}`).toBeUndefined();
      seen.set(svg, s);
    }
  });
});
