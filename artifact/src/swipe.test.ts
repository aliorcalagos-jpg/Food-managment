import { describe, expect, it } from "vitest";
import { ACTION_W, clampOffset, FULL_AT, logicalDx, OPEN_AT, physicalShift, swipeEnd } from "./swipe";

describe("swipe rules", () => {
  it("mirrors the drag direction in right-to-left text", () => {
    expect(logicalDx(-80, false)).toBe(-80); // left in English reveals Delete
    expect(logicalDx(80, true)).toBe(-80); // right in Arabic reveals Delete
    expect(physicalShift(-88, true)).toBe(88);
    expect(physicalShift(-88, false)).toBe(-88);
  });
  it("decides what a finished drag does", () => {
    expect(swipeEnd(10, true, true)).toBe("close");
    expect(swipeEnd(OPEN_AT, true, true)).toBe("toggle");
    expect(swipeEnd(-OPEN_AT, true, true)).toBe("open");
    expect(swipeEnd(-FULL_AT, true, true)).toBe("delete");
    expect(swipeEnd(-FULL_AT - 10, false, true)).toBe("delete");
  });
  it("ignores a direction with no action", () => {
    expect(swipeEnd(OPEN_AT * 2, false, true)).toBe("close");
    expect(swipeEnd(-FULL_AT, true, false)).toBe("close");
    expect(clampOffset(-500, true, false)).toBe(0);
    expect(clampOffset(500, false, true)).toBe(0);
  });
  it("limits how far a row can be dragged", () => {
    expect(clampOffset(-1000, true, true)).toBe(-(FULL_AT + 40));
    expect(clampOffset(1000, true, true)).toBe(OPEN_AT * 2);
    expect(ACTION_W).toBeGreaterThan(OPEN_AT / 2);
  });
});
