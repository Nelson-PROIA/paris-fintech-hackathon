/**
 * Deploys MockEUR + LoanlyMarketplace to the configured RPC endpoint and
 * writes the addresses to `data/chain.json`. Idempotent — re-running
 * deploys fresh contracts and overwrites the address file (existing on-chain
 * state is forgotten, which is exactly what we want when restarting Anvil).
 *
 * Usage:
 *   pnpm chain:node          # in another terminal
 *   pnpm chain:deploy
 */
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, createWalletClient, http } from "viem";
import {
  MARKETPLACE_ABI,
  MARKETPLACE_BYTECODE,
  MOCK_EUR_ABI,
  MOCK_EUR_BYTECODE,
} from "../lib/chain/abi";
import {
  loanlyChain,
  RPC_URL,
  OPERATOR_PRIVATE_KEY,
  writeChainAddresses,
} from "../lib/chain/config";

async function main() {
  const account = privateKeyToAccount(OPERATOR_PRIVATE_KEY);
  const publicClient = createPublicClient({
    chain: loanlyChain,
    transport: http(RPC_URL),
  });
  const wallet = createWalletClient({
    account,
    chain: loanlyChain,
    transport: http(RPC_URL),
  });

  console.log(`Deployer: ${account.address}`);
  console.log(`RPC:      ${RPC_URL}`);
  console.log(`Chain id: ${loanlyChain.id}`);
  const blockNumber = await publicClient.getBlockNumber();
  console.log(`Connected. Current block: ${blockNumber}`);

  console.log("Deploying MockEUR…");
  const mockEurHash = await wallet.deployContract({
    abi: MOCK_EUR_ABI,
    bytecode: MOCK_EUR_BYTECODE,
    args: [account.address],
    account,
    chain: loanlyChain,
  });
  const mockEurReceipt = await publicClient.waitForTransactionReceipt({
    hash: mockEurHash,
  });
  if (!mockEurReceipt.contractAddress) {
    throw new Error("MockEUR deploy: no contractAddress in receipt");
  }
  const mockEurAddress = mockEurReceipt.contractAddress;
  console.log(`  → ${mockEurAddress} (tx ${mockEurHash})`);

  console.log("Deploying LoanlyMarketplace…");
  const marketplaceHash = await wallet.deployContract({
    abi: MARKETPLACE_ABI,
    bytecode: MARKETPLACE_BYTECODE,
    args: [account.address, mockEurAddress],
    account,
    chain: loanlyChain,
  });
  const marketplaceReceipt = await publicClient.waitForTransactionReceipt({
    hash: marketplaceHash,
  });
  if (!marketplaceReceipt.contractAddress) {
    throw new Error("LoanlyMarketplace deploy: no contractAddress in receipt");
  }
  const marketplaceAddress = marketplaceReceipt.contractAddress;
  console.log(`  → ${marketplaceAddress} (tx ${marketplaceHash})`);

  writeChainAddresses({
    chainId: loanlyChain.id,
    marketplaceAddress,
    mockEurAddress,
    deployedAt: Date.now(),
    deployer: account.address,
  });

  console.log("\nWrote data/chain.json");
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
