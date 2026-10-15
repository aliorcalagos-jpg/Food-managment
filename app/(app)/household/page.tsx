import { regenerateInviteAction } from "@/app/actions/household";
import { requireHousehold } from "@/lib/dal";
import { listMembers } from "@/lib/household-service";

// Reads the session: blocks on the server (see authentication-with-cache-components guide).
export const instant = false;

export default async function HouseholdPage() {
  const { household, householdId, role } = await requireHousehold();
  const members = await listMembers(householdId);
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{household.name}</h1>
      <section className="space-y-2">
        <h2 className="font-medium">Invite code</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Share this with people you live with so they can join.</p>
        <code className="block rounded-md bg-zinc-100 px-3 py-2 dark:bg-zinc-800">{household.inviteCode}</code>
        {role === "OWNER" && (
          <form action={regenerateInviteAction}>
            <button className="text-sm underline">Generate a new code (old one stops working)</button>
          </form>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Members</h2>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {members.map((m) => (
            <li key={m.userId} className="flex justify-between py-2 text-sm">
              <span>{m.user.name ?? m.user.email}</span>
              <span className="text-zinc-500">{m.role === "OWNER" ? "Owner" : "Member"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
