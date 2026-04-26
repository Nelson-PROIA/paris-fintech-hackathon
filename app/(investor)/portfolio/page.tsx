import { listCountries, listSectors } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { PortfolioClient } from "./PortfolioClient";
import { ActiveCommitments } from "./ActiveCommitments";

export default async function PortfolioPage() {
  const user = await requireRole("investor");
  const allSectors = listSectors();
  const allCountries = listCountries();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Portfolio constructor
        </p>
        <h1 className="mt-2 text-balance text-4xl font-semibold tracking-[-0.025em]">
          Build a portfolio in 20 seconds.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Set constraints — capital, stage, geography, risk. The AI re-ranks
          live SMBs against your thesis and proposes an allocation with one
          line of reasoning per position.
        </p>
      </header>

      <div className="mb-8">
        <ActiveCommitments userId={user.id} />
      </div>

      <PortfolioClient allSectors={allSectors} allCountries={allCountries} />
    </main>
  );
}
