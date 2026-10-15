/** Only http(s) links are accepted, so a `javascript:` or `data:` URL can never be saved or rendered as a link. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
