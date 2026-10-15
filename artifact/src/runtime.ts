// The slice of the claude.ai artifact runtime this page uses (contract 0.2.x):
// `window.claude.use(name)` resolves a capability namespace, or null when unavailable.

export type DocSnap = { id: string; exists: boolean; data(): Record<string, unknown> | undefined };
export type QuerySnap = { docs: DocSnap[] };
export type DocRef = { set(data: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
export type CollectionRef = {
  doc(id?: string): DocRef;
  onSnapshot(next: (s: QuerySnap) => void, error?: (e: { code: string; message: string }) => void): () => void;
};
export type Db = { collection(path: string): CollectionRef };
export type UserApi = { isOwner(): Promise<boolean>; canEdit(): Promise<boolean>; can(name: string): Promise<boolean | null> };

declare global {
  interface Window {
    claude?: { use(name: string): Promise<unknown> };
  }
}

export async function getCapability<T>(name: string): Promise<T | null> {
  try {
    return ((await window.claude?.use(name)) as T | null | undefined) ?? null;
  } catch {
    return null;
  }
}
