import { listCountries, listSectors } from "@/lib/db";
import { PortfolioClient } from "./PortfolioClient";

export default async function PortfolioPage() {
  const allSectors = listSectors();
  const allCountries = listCountries();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Build a portfolio
        </h1>
        <p className="mt-1 text-muted-foreground">
          Set constraints. The AI re-ranks SMBs and proposes an allocation in &lt;20s.
        </p>
      </header>
      <PortfolioClient allSectors={allSectors} allCountries={allCountries} />
    </main>
  );
}
