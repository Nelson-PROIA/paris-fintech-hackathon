import { AddressLine } from "./AddressLine";

/**
 * "Who is what" on-chain. Lays out every immutable identifier needed to
 * verify the contract independently — addresses, network, the bytes32
 * campaign key, and the deploy transaction. All copyable, all monospace.
 */
export function IdentityPanel({
  marketplaceAddress,
  tokenAddress,
  borrowerAddress,
  campaignKey,
  chainId,
  chainName,
  deployTxHash,
  createdAt,
}: {
  marketplaceAddress: string;
  tokenAddress: string;
  borrowerAddress: string;
  campaignKey: string;
  chainId: number;
  chainName: string;
  deployTxHash: string;
  createdAt: number;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            On-chain identity
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Immutable references — copy any of these to read the contract from
            an independent client.
          </p>
        </div>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
          {chainName} · chainId {chainId}
        </span>
      </header>

      <div className="grid gap-4 p-6 md:grid-cols-2">
        <AddressLine label="Marketplace contract" value={marketplaceAddress} />
        <AddressLine label="mEURC token (ERC-20)" value={tokenAddress} />
        <AddressLine label="Borrower wallet" value={borrowerAddress} />
        <AddressLine label="Campaign key (bytes32)" value={campaignKey} />
        <div className="md:col-span-2">
          <AddressLine label="Deploy tx" value={deployTxHash} />
        </div>
      </div>

      <footer className="border-t border-border px-6 py-3 text-[11px] text-muted-foreground">
        Deployed{" "}
        <span suppressHydrationWarning>
          {new Date(createdAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </footer>
    </section>
  );
}
