"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { LoanlyLogo } from "@/components/ui/loanly-mark";

type NavLink = { href: string; label: string; action?: boolean };

const SMB_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboard?force=1", label: "+ New company", action: true },
];

const INVESTOR_LINKS: NavLink[] = [
  { href: "/feed", label: "Feed" },
  { href: "/matches", label: "Matches" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/thesis", label: "Profile" },
];

export function TopNav({ role }: { role: "smb" | "investor" }) {
  const pathname = usePathname();
  const links = role === "smb" ? SMB_LINKS : INVESTOR_LINKS;

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="inline-flex items-center transition hover:opacity-80"
          >
            <LoanlyLogo size="md" />
          </Link>
          <ul className="hidden items-center gap-1 text-sm md:flex">
            {links.map((l) => {
              const path = l.href.split("?")[0];
              const active = pathname === path || pathname.startsWith(path + "/");
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={cn(
                      "relative rounded-md px-3 py-1.5 transition",
                      l.action
                        ? "text-foreground font-medium hover:bg-accent"
                        : active
                          ? "text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {l.label}
                    {!l.action && active && (
                      <span className="pointer-events-none absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline-flex">
            {role === "smb" ? "Founder" : "Investor"}
          </span>
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </div>
      </div>
    </nav>
  );
}
