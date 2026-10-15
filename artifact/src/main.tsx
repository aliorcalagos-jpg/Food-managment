import { createRoot } from "react-dom/client";
import { getCapability, type Db } from "./runtime";
import { createStore } from "./store";
import { App } from "./ui/App";

async function start() {
  const root = document.getElementById("root");
  if (!root) return;
  // null when signed out, not granted, or opened outside claude.ai; the app then explains itself.
  const db = await getCapability<Db>("db");
  createRoot(root).render(<App store={createStore(db)} />);
}

void start();
