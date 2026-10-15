// Swipe-row rules, kept free of the DOM so they can be tested. Offsets are "logical": positive reveals the
// leading actions (Done), negative the trailing ones (Delete). In right-to-left text the physical direction
// of a drag is mirrored, so a row behaves like it does in an Arabic iPhone app.
export const OPEN_AT = 64;
export const FULL_AT = 200;
export const ACTION_W = 88;
export type SwipeEnd = "close" | "toggle" | "open" | "delete";

export const logicalDx = (dx: number, rtl: boolean): number => (rtl ? -dx : dx);
/** The sideways shift to draw, in physical pixels. */
export const physicalShift = (logical: number, rtl: boolean): number => (rtl ? -logical : logical);

/** Keeps a drag inside what the row can show: nothing past an action that does not exist. */
export function clampOffset(logical: number, hasToggle: boolean, hasDelete: boolean): number {
  return Math.max(hasDelete ? -(FULL_AT + 40) : 0, Math.min(hasToggle ? OPEN_AT * 2 : 0, logical));
}

/** What a drag that ends at `logical` does. */
export function swipeEnd(logical: number, hasToggle: boolean, hasDelete: boolean): SwipeEnd {
  if (hasToggle && logical >= OPEN_AT) return "toggle";
  if (hasDelete && logical <= -FULL_AT) return "delete";
  if (hasDelete && logical <= -OPEN_AT) return "open";
  return "close";
}
