import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { getCurrentUser } from "@/lib/auth";
import { listCompaniesByUserId } from "@/lib/db";

const INVESTOR_LINKS = [
  { href: "/matches", label: "Matches" },
  { href: "/feed", label: "Feed" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/thesis", label: "Thesis" },
];

export async function TopNav({ role }: { role: "smb" | "investor" }) {
  const links = role === "smb" ? await buildSmbLinks() : INVESTOR_LINKS;
  return (
    <nav className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          SMB ↔ Investor
        </Link>
        <ul className="flex items-center gap-4 text-sm text-muted-foreground">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <UserButton />
    </nav>
  );
}

/**
 * SMB navigation depends on whether the user has already onboarded a company.
 * Once onboarded, "Onboard" disappears and we surface "Mon entreprise" pointing
 * at the (single) company. Multi-company support can extend this later by
 * showing a dropdown.
 */
async function buildSmbLinks(): Promise<{ href: string; label: string }[]> {
  const links: { href: string; label: string }[] = [
    { href: "/dashboard", label: "Dashboard" },
  ];
  const user = await getCurrentUser();
  if (!user) {
    links.push({ href: "/onboard", label: "Onboard" });
    return links;
  }
  const companies = listCompaniesByUserId(user.id);
  if (companies.length === 0) {
    links.push({ href: "/onboard", label: "Onboarder ma boîte" });
  } else {
    links.push({
      href: `/company/${companies[0].id}`,
      label: "Mon entreprise",
    });
  }
  return links;
}
