import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const sans = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

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
      <html
        lang="en"
        className={cn("font-sans", sans.variable, mono.variable)}
        suppressHydrationWarning
      >
        <body className="min-h-screen antialiased" suppressHydrationWarning>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
