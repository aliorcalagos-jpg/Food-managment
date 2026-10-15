/** "Dinner, dinner ,  Quick," -> ["dinner", "quick"]: lowercased, trimmed, deduped, max 30 chars each. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 30);
    if (t) seen.add(t);
  }
  return [...seen];
}
