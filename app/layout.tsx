import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "SMB ↔ Investor Marketplace",
  description: "AI-powered marketplace connecting European SMBs with investors.",
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
