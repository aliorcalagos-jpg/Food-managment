// Build-time stand-in: the page loads React from cdnjs (a pinned UMD build) and this exposes the
// global to the bundle, so React's source is not inlined into the page.
const R = (window as unknown as { React: typeof import("react") }).React;
export default R;
export const { useState, useMemo, useRef, useEffect, useCallback, useSyncExternalStore, useContext, createContext, createElement, Fragment } = R;
