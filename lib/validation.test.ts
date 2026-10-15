import { describe, expect, it } from "vitest";
import { fieldErrors, signupSchema } from "./validation";

describe("signupSchema", () => {
  it("lowercases and trims email", () => {
    const r = signupSchema.parse({ name: " Ann ", email: "  Ann@Example.COM ", password: "longenough1" });
    expect(r).toEqual({ name: "Ann", email: "ann@example.com", password: "longenough1" });
  });

  it("reports the first error per field", () => {
    const r = signupSchema.safeParse({ name: "", email: "nope", password: "short" });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error)).sort()).toEqual(["email", "name", "password"]);
  });

  it("caps passwords at 72 chars (bcrypt limit)", () => {
    expect(signupSchema.safeParse({ name: "a", email: "a@b.co", password: "x".repeat(73) }).success).toBe(false);
  });
});
