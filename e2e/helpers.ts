import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

export const password = "correct-horse-battery";

export async function signupAndCreateHousehold(page: Page, tag: string, who: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(who);
  await page.getByLabel("Email").fill(`${tag}-${who.toLowerCase()}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Household name").fill(`${tag} ${who} home`);
  await page.getByRole("button", { name: "Create household" }).click();
  await expect(page).toHaveURL(/\/recipes$/);
}

export async function cleanup(tag: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`delete from "Household" where name like $1`, [`${tag}%`]);
  await pool.query(`delete from "User" where email like $1`, [`${tag}%`]);
  await pool.end();
}

export type Ing = [qty: string, unit: string, name: string];

export async function addRecipe(page: Page, title: string, servings: string, ingredients: Ing[]) {
  await page.goto("/recipes/new");
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Servings", { exact: true }).fill(servings);
  for (const [i, [qty, unit, name]] of ingredients.entries()) {
    if (i > 0) await page.getByRole("button", { name: "+ Add ingredient" }).click();
    await page.getByLabel(`Quantity ${i + 1}`, { exact: true }).fill(qty);
    await page.getByLabel(`Unit ${i + 1}`, { exact: true }).fill(unit);
    await page.getByLabel(`Ingredient ${i + 1}`, { exact: true }).fill(name);
  }
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}
