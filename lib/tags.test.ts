import { describe, expect, it } from "vitest";
import { parseTags } from "./tags";

describe("parseTags", () => {
  it("splits on the Arabic comma, semicolons and the usual comma, and dedupes", () => {
    expect(parseTags("غداء، سريع ,  غداء ؛ شتوي; Quick")).toEqual(["غداء", "سريع", "شتوي", "quick"]);
  });
  it("keeps the English behaviour", () => {
    expect(parseTags("Dinner, dinner ,  Quick,")).toEqual(["dinner", "quick"]);
  });
});
