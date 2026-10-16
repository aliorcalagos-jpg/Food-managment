import { createRoot } from "react-dom/client";
import { createLocalDb } from "./localdb";
import { getCapability, type Db } from "./runtime";
import { createStore } from "./store";
import { App } from "./ui/App";

declare const __STANDALONE__: boolean;

async function start() {
  const root = document.getElementById("root");
  if (!root) return;
  // null when signed out, not granted, or opened outside claude.ai; the app then explains itself.
  // The Android app has no claude.ai account, so it keeps its data on the device instead.
  const db = (await getCapability<Db>("db")) ?? (__STANDALONE__ ? createLocalDb() : null);
  createRoot(root).render(<App store={createStore(db)} />);
}

void start();
