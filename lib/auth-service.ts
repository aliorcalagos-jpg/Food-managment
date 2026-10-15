import bcrypt from "bcryptjs";
import { db } from "./db";

const COST = 12;

// Compared against when the email is unknown, so response time doesn't reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", COST);

export class EmailTakenError extends Error {}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(input.password, COST);
  try {
    return await db.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: { id: true },
    });
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      throw new EmailTakenError();
    }
    throw e;
  }
}

/** Returns the user id on success, null on any failure. */
export async function authenticate(email: string, password: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? user.id : null;
}
