import Link from "next/link";
import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/dal";
import { readSession } from "@/lib/session";

// Session-dependent: blocks on the server instead of streaming a static shell (see
// node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md).
export const instant = false;

export default async function Home() {
  if (await readSession()) {
    redirect((await getHouseholdContext()) ? "/recipes" : "/onboarding");
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-semibold">Plan the week, shop once.</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Save recipes, plan your household&apos;s meals, and get one merged shopping list.
      </p>
      <div className="flex gap-3">
        <Link className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white" href="/signup">Sign up</Link>
        <Link className="rounded-md border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700" href="/login">Log in</Link>
      </div>
    </main>
  );
}
