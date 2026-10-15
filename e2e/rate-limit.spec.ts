import "dotenv/config";
import { expect, test } from "@playwright/test";
import { cleanup, password, signupAndCreateHousehold, resetLoopbackRateLimits } from "./helpers";

const tag = `e2erl-${Date.now()}`;
test.beforeAll(resetLoopbackRateLimits);
test.afterAll(async () => {
  await cleanup(tag);
});

test("repeated failed logins get throttled, and the correct password is held back too", async ({ page, browser }) => {
  await signupAndCreateHousehold(page, tag, "Ann");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  const email = `${tag}-ann@example.com`;
  // 10 attempts are allowed per account (signing up created the session directly, so it did not count)
  const attempt = async (pw: string) => {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(pw);
    await page.getByRole("button", { name: "Log in" }).click();
    // React clears the password field when the action finishes. Waiting for that keeps
    // each attempt separate; the previous attempt's message is still on screen until then.
    await expect(page.getByLabel("Password")).toHaveValue("");
  };
  for (let i = 0; i < 10; i++) {
    await attempt(`wrong-password-${i}`);
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  }

  // the 11th is throttled, even with the right password
  await attempt(password);
  await expect(page.getByText(/Too many attempts/)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  // a different account is unaffected
  const other = await browser.newContext();
  const o = await other.newPage();
  await signupAndCreateHousehold(o, tag, "Bob");
  await o.getByRole("button", { name: "Log out" }).click();
  await expect(o).toHaveURL(/\/login$/);
  await o.getByLabel("Email").fill(`${tag}-bob@example.com`);
  await o.getByLabel("Password").fill(password);
  await o.getByRole("button", { name: "Log in" }).click();
  await expect(o).toHaveURL(/\/recipes$/);
  await other.close();
});
