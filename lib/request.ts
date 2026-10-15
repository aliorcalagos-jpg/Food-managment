import "server-only";
import { headers } from "next/headers";

/**
 * Client IP as set by the hosting proxy. Only meaningful behind a proxy that
 * overwrites X-Forwarded-For (Vercel does); on a host that passes the client's
 * own header through, it could be spoofed, so rate limits also work per account.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || null;
}
