import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireHousehold } from "@/lib/dal";

// Session-dependent: blocks on the server instead of streaming a static shell (see
// node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md).
export const instant = false;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { household } = await requireHousehold();
  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="flex items-center justify-between gap-4 py-4">
        <nav className="flex items-center gap-4 text-sm">
          <span className="font-semibold">{household.name}</span>
          <Link href="/recipes">Recipes</Link>
          <Link href="/planner">Planner</Link>
          <Link href="/lists">Lists</Link>
          <Link href="/household">Household</Link>
        </nav>
        <form action={logout}>
          <button className="text-sm underline">Log out</button>
        </form>
      </header>
      <main className="py-6">{children}</main>
    </div>
  );
}
