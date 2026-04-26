/**
 * Static ABI/bytecode imports for our two on-chain contracts.
 *
 * Hardhat writes JSON artifacts to `contracts/artifacts/contracts/<File>.sol/`.
 * We import the JSON directly so the chain library never needs solc at
 * runtime — `pnpm chain:compile` ahead of time is enough.
 */

import LoanlyMarketplaceArtifact from "../../contracts/artifacts/contracts/LoanlyMarketplace.sol/LoanlyMarketplace.json";
import MockEURArtifact from "../../contracts/artifacts/contracts/MockEUR.sol/MockEUR.json";
import type { Abi, Hex } from "viem";

export const MARKETPLACE_ABI = LoanlyMarketplaceArtifact.abi as Abi;
export const MARKETPLACE_BYTECODE =
  LoanlyMarketplaceArtifact.bytecode as Hex;

export const MOCK_EUR_ABI = MockEURArtifact.abi as Abi;
export const MOCK_EUR_BYTECODE = MockEURArtifact.bytecode as Hex;

export const TOKEN_DECIMALS = 6;

/** Lifecycle enum mapping kept in lockstep with `LoanlyMarketplace.sol::Status`. */
export const ON_CHAIN_STATUS = [
  "none",
  "open",
  "funded",
  "repaying",
  "repaid",
  "cancelled",
] as const;

export type OnChainStatus = (typeof ON_CHAIN_STATUS)[number];
