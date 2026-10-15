import "server-only";
import { cookies } from "next/headers";
import { decrypt, encrypt, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./session-token";

export async function createSession(userId: string) {
  const token = await encrypt({ userId });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession() {
  return decrypt((await cookies()).get(SESSION_COOKIE)?.value);
}
