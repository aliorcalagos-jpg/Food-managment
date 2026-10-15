import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session-token";

const PROTECTED = ["/recipes", "/planner", "/lists", "/household", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup"];

const matches = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

// Optimistic check only: redirects based on a verifiable cookie. Real
// authorization happens in lib/dal.ts, because Server Functions can bypass this.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && matches(pathname, PROTECTED)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && matches(pathname, AUTH_PAGES)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
