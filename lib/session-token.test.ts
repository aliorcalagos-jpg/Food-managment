import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./session-token";

describe("session tokens", () => {
  it("round-trips the user id", async () => {
    expect(await decrypt(await encrypt({ userId: "u1" }))).toEqual({ userId: "u1" });
  });

  it("rejects missing and garbage tokens", async () => {
    expect(await decrypt(undefined)).toBeNull();
    expect(await decrypt("not.a.jwt")).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await encrypt({ userId: "u1" });
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "admin" })).toString("base64url");
    expect(await decrypt(`${h}.${forged}.${s}`)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const other = await new SignJWT({ userId: "u1" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-completely-different-secret-value-0000"));
    expect(await decrypt(other)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ userId: "u1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));
    expect(await decrypt(expired)).toBeNull();
  });

  it("rejects an unsigned (alg none) token", async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ userId: "u1" })}.`;
    expect(await decrypt(none)).toBeNull();
  });
});
