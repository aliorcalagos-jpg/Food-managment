import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/dal";
import { CreateHouseholdForm, JoinHouseholdForm } from "./forms";

// Session-dependent: blocks on the server instead of streaming a static shell (see
// node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md).
export const instant = false;

export default async function OnboardingPage() {
  if (await getHouseholdContext()) redirect("/");
  return (
    <main className="mx-auto max-w-sm space-y-10 px-4 py-12">
      <h1 className="text-2xl font-semibold">Set up your household</h1>
      <section className="space-y-3">
        <h2 className="font-medium">Start a new household</h2>
        <CreateHouseholdForm />
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">Or join one with an invite code</h2>
        <JoinHouseholdForm />
      </section>
    </main>
  );
}
