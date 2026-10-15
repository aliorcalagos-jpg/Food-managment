import { afterAll, describe, expect, it } from "vitest";
import { authenticate, EmailTakenError, registerUser } from "./auth-service";
import { db } from "./db";
import {
  AlreadyInHouseholdError,
  createHousehold,
  ForbiddenError,
  InvalidInviteError,
  joinHousehold,
  regenerateInviteCode,
} from "./household-service";

const run = process.env.DATABASE_URL ? describe : describe.skip;
const tag = `it-${Date.now()}`;
const email = (n: string) => `${tag}-${n}@example.com`;

run("auth + households (database)", () => {
  afterAll(async () => {
    await db.household.deleteMany({ where: { name: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.$disconnect();
  });

  it("registers, rejects duplicates, authenticates", async () => {
    const { id } = await registerUser({ name: "A", email: email("a"), password: "correct-horse" });
    await expect(registerUser({ name: "A2", email: email("a"), password: "whatever12" })).rejects.toBeInstanceOf(EmailTakenError);
    expect(await authenticate(email("a"), "correct-horse")).toBe(id);
    expect(await authenticate(email("a"), "wrong-password")).toBeNull();
    expect(await authenticate(email("nobody"), "correct-horse")).toBeNull();
  });

  it("creates a household, joins by code, enforces rules", async () => {
    const owner = await registerUser({ name: "Owner", email: email("o"), password: "password-1" });
    const member = await registerUser({ name: "Member", email: email("m"), password: "password-2" });
    const outsider = await registerUser({ name: "Out", email: email("x"), password: "password-3" });

    const h = await createHousehold(owner.id, `${tag} Home`);
    await expect(createHousehold(owner.id, `${tag} Second`)).rejects.toBeInstanceOf(AlreadyInHouseholdError);

    await expect(joinHousehold(member.id, "bogus-code")).rejects.toBeInstanceOf(InvalidInviteError);
    await joinHousehold(member.id, h.inviteCode);
    await expect(joinHousehold(member.id, h.inviteCode)).rejects.toBeInstanceOf(AlreadyInHouseholdError);

    // only the owner can rotate the code, and the old code stops working
    await expect(regenerateInviteCode(member.id, h.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(regenerateInviteCode(outsider.id, h.id)).rejects.toBeInstanceOf(ForbiddenError);
    const { inviteCode } = await regenerateInviteCode(owner.id, h.id);
    expect(inviteCode).not.toBe(h.inviteCode);
    await expect(joinHousehold(outsider.id, h.inviteCode)).rejects.toBeInstanceOf(InvalidInviteError);
    await joinHousehold(outsider.id, inviteCode);

    const roles = await db.membership.findMany({ where: { householdId: h.id }, select: { role: true } });
    expect(roles.map((r) => r.role).sort()).toEqual(["MEMBER", "MEMBER", "OWNER"]);
  });
});
