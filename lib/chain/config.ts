import fs from "node:fs";
import path from "node:path";
import { defineChain } from "viem";

export const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
export const CHAIN_ID = Number(process.env.CHAIN_ID || 31337);

/**
 * Default Hardhat dev account #0 (`0xf39Fd...92266`). We use it as the
 * operator (deployer + onlyOperator caller) when no override is provided so
 * `pnpm chain:node` + `pnpm chain:deploy` works end-to-end with zero env
 * configuration.
 */
const DEFAULT_DEV_OPERATOR_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export const OPERATOR_PRIVATE_KEY = (process.env.OPERATOR_PRIVATE_KEY ||
  DEFAULT_DEV_OPERATOR_PK) as `0x${string}`;

const DEFAULT_DEV_ENCRYPTION_KEY =
  "0x4c6f616e6c79446576456e6372797074696f6e4b657931323334353637383930";

export const OPERATOR_ENCRYPTION_KEY = (process.env.OPERATOR_ENCRYPTION_KEY ||
  DEFAULT_DEV_ENCRYPTION_KEY) as `0x${string}`;

export const loanlyChain = defineChain({
  id: CHAIN_ID,
  name: "Loanly Local",
  network: "loanly-local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
});

export type ChainAddresses = {
  chainId: number;
  marketplaceAddress: `0x${string}`;
  mockEurAddress: `0x${string}`;
  deployedAt: number;
  deployer: `0x${string}`;
};

const ADDR_FILE = path.resolve(process.cwd(), "data/chain.json");

export function readChainAddresses(): ChainAddresses | null {
  try {
    const raw = fs.readFileSync(ADDR_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.marketplaceAddress === "string" &&
      typeof parsed.mockEurAddress === "string"
    ) {
      return parsed as ChainAddresses;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeChainAddresses(addrs: ChainAddresses): void {
  const dir = path.dirname(ADDR_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ADDR_FILE, JSON.stringify(addrs, null, 2));
}

export function requireChainAddresses(): ChainAddresses {
  const addrs = readChainAddresses();
  if (!addrs) {
    throw new Error(
      "Chain not initialised. Run `pnpm chain:node` (in another terminal) and `pnpm chain:deploy`."
    );
  }
  return addrs;
}
