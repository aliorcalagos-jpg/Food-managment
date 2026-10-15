import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { cleanup, resetLoopbackRateLimits } from "./helpers";

const tag = `e2e-${Date.now()}`;
const emailA = `${tag}-a@example.com`;
const emailB = `${tag}-b@example.com`;
const password = "correct-horse-battery";

test.beforeAll(resetLoopbackRateLimits);
test.afterAll(() => cleanup(tag));

async function signup(page: Page, name: string, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

test("signup, household, invite, join, logout", async ({ page, browser }) => {
  // logged out users are sent to login
  await page.goto("/recipes");
  await expect(page).toHaveURL(/\/login$/);

  // owner signs up (weak password rejected first) and creates a household
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ann");
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("At least 8 characters")).toBeVisible();
  await signup(page, "Ann", emailA);

  await page.getByLabel("Household name").fill(`${tag} Home`);
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByText(`${tag} Home`)).toBeVisible();

  await page.getByRole("link", { name: "Household" }).click();
  const code = (await page.locator("code").innerText()).trim();
  expect(code.length).toBeGreaterThan(8);

  // second user joins with the code
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await signup(b, "Bob", emailB);
  await b.getByLabel("Invite code").fill("not-a-real-code");
  await b.getByRole("button", { name: "Join household" }).click();
  await expect(b.getByText("That invite code isn't valid")).toBeVisible();
  await b.getByLabel("Invite code").fill(code);
  await b.getByRole("button", { name: "Join household" }).click();
  await expect(b).toHaveURL(/\/recipes$/);
  await b.getByRole("link", { name: "Household" }).click();
  await expect(b.getByText("Ann")).toBeVisible();
  await expect(b.getByText("Bob")).toBeVisible();
  // members can't rotate the code
  await expect(b.getByRole("button", { name: /Generate a new code/ })).toHaveCount(0);

  // owner rotates the code
  await page.getByRole("button", { name: /Generate a new code/ }).click();
  await expect(page.locator("code")).not.toHaveText(code);

  // logout, then bad and good login
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/recipes");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email").fill(emailA);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/recipes$/);

  await ctxB.close();
});
