import { listCountries, listSectors } from "@/lib/db";
import { PortfolioClient } from "./PortfolioClient";
import { Badge } from "@/components/ui/badge";

export default async function PortfolioPage() {
  const allSectors = listSectors();
  const allCountries = listCountries();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <Badge variant="brand" className="mb-3 px-3 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
          </span>
          Portfolio constructor
        </Badge>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          <span className="serif-italic gradient-headline">Build</span> a
          portfolio in 20 seconds.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Set constraints — capital, stage, geography, risk. The AI re-ranks
          live SMBs against your thesis and proposes an allocation with one
          line of reasoning per position.
        </p>
      </header>
      <PortfolioClient allSectors={allSectors} allCountries={allCountries} />
    </main>
  );
}
