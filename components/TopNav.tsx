import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

const SMB_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboard", label: "Onboard" },
];

const INVESTOR_LINKS = [
  { href: "/matches", label: "Matches" },
  { href: "/feed", label: "Feed" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/thesis", label: "Thesis" },
];

export function TopNav({ role }: { role: "smb" | "investor" }) {
  const links = role === "smb" ? SMB_LINKS : INVESTOR_LINKS;
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
