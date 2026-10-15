import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";

/** Valid session or redirect to /login. Memoized per request. */
export const verifySession = cache(async () => {
  const session = await readSession();
  if (!session) redirect("/login");
  return session;
});

/**
 * Current user's household context. Membership is re-read from the DB on every
 * request, so it is never trusted from the cookie. MVP: one household per user.
 */
export const getHouseholdContext = cache(async () => {
  const { userId } = await verifySession();
  const membership = await db.membership.findFirst({
    where: { userId },
    include: { household: true },
    orderBy: { household: { createdAt: "asc" } },
  });
  if (!membership) return null;
  return {
    userId,
    householdId: membership.householdId,
    role: membership.role,
    household: membership.household,
  };
});

/** Like getHouseholdContext but sends users without a household to onboarding. */
export async function requireHousehold() {
  const ctx = await getHouseholdContext();
  if (!ctx) redirect("/onboarding");
  return ctx;
}
