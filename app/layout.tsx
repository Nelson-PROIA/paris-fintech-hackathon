import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Loanly — AI-native marketplace for European SMBs and investors",
  description:
    "Loanly matches European SMBs raising capital with thesis-driven investors. AI-powered onboarding, due diligence, portfolio construction, and collateral verification.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
        <body className="min-h-screen antialiased" suppressHydrationWarning>{children}</body>
      </html>
    </ClerkProvider>
  );
}
