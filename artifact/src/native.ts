// Files and haptics. In the Android app a tiny bridge (MainActivity.java) opens the system file dialogs, which need no
// permissions; in a browser (and on claude.ai) a download link and a file input do the same job.
type Bridge = { save(name: string, text: string): void; pick(): void; haptic(kind: string): void };
type Win = Window & { AndroidBridge?: Bridge; __saved?: (ok: boolean) => void; __picked?: (text: string | null) => void };
const w = () => window as Win;

export const isAndroidApp = () => !!w().AndroidBridge;

/** Gives the person a file to keep. Resolves false when they cancel the save dialog. */
export function saveTextFile(name: string, text: string): Promise<boolean> {
  const bridge = w().AndroidBridge;
  if (bridge) {
    return new Promise((resolve) => {
      w().__saved = resolve;
      bridge.save(name, text);
    });
  }
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return Promise.resolve(true);
}

/** Lets the person choose a file and returns its text (null when they cancel). */
export function pickTextFile(): Promise<string | null> {
  const bridge = w().AndroidBridge;
  if (bridge) {
    return new Promise((resolve) => {
      w().__picked = resolve;
      bridge.pick();
    });
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve, () => resolve(null));
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/** A short vibration for a tap, in the Android app only. kind: "tick" | "thud" | "success". */
export function haptic(kind: "tick" | "thud" | "success") {
  try {
    w().AndroidBridge?.haptic(kind);
  } catch {
    /* no haptics here */
  }
}
