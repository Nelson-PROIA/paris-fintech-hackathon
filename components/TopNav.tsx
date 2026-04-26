"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { LoanlyMark } from "@/components/ui/loanly-mark";

const SMB_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
];

const INVESTOR_LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/matches", label: "Matches" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/thesis", label: "Thesis" },
];

export function TopNav({ role }: { role: "smb" | "investor" }) {
  const pathname = usePathname();
  const links = role === "smb" ? SMB_LINKS : INVESTOR_LINKS;

  return (
    <nav className="glass-strong sticky top-0 z-40 border-b border-border/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em] transition hover:opacity-80"
          >
            <LoanlyMark size={20} />
            Loanly
          </Link>
          <ul className="hidden items-center gap-1 text-sm md:flex">
            {links.map((l) => {
              const active =
                pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={cn(
                      "relative rounded-md px-3 py-1.5 transition",
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    {l.label}
                    {active && (
                      <span className="pointer-events-none absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline-flex">
            {role === "smb" ? "Founder" : "Investor"}
          </span>
          <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
        </div>
      </div>
    </nav>
  );
}
