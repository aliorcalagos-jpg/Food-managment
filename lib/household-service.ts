import { randomBytes } from "node:crypto";
import { db } from "./db";

export class AlreadyInHouseholdError extends Error {}
export class InvalidInviteError extends Error {}
export class ForbiddenError extends Error {}

const newInviteCode = () => randomBytes(12).toString("base64url");

export async function createHousehold(userId: string, name: string) {
  return db.$transaction(async (tx) => {
    if (await tx.membership.findFirst({ where: { userId } })) throw new AlreadyInHouseholdError();
    return tx.household.create({
      data: {
        name,
        inviteCode: newInviteCode(),
        members: { create: { userId, role: "OWNER" } },
      },
    });
  });
}

export async function joinHousehold(userId: string, code: string) {
  return db.$transaction(async (tx) => {
    if (await tx.membership.findFirst({ where: { userId } })) throw new AlreadyInHouseholdError();
    const household = await tx.household.findUnique({ where: { inviteCode: code } });
    if (!household) throw new InvalidInviteError();
    await tx.membership.create({ data: { userId, householdId: household.id, role: "MEMBER" } });
    return household;
  });
}

export async function regenerateInviteCode(userId: string, householdId: string) {
  const membership = await db.membership.findUnique({
    where: { userId_householdId: { userId, householdId } },
  });
  if (membership?.role !== "OWNER") throw new ForbiddenError();
  return db.household.update({
    where: { id: householdId },
    data: { inviteCode: newInviteCode() },
    select: { inviteCode: true },
  });
}

export async function listMembers(householdId: string) {
  return db.membership.findMany({
    where: { householdId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
}
