import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loanlyChain, RPC_URL, OPERATOR_PRIVATE_KEY } from "./config";

let _public: PublicClient | null = null;
let _operator: WalletClient | null = null;

export function publicClient(): PublicClient {
  if (_public) return _public;
  _public = createPublicClient({
    chain: loanlyChain,
    transport: http(RPC_URL),
  });
  return _public;
}

export function operatorClient(): WalletClient {
  if (_operator) return _operator;
  const account = privateKeyToAccount(OPERATOR_PRIVATE_KEY);
  _operator = createWalletClient({
    account,
    chain: loanlyChain,
    transport: http(RPC_URL),
  });
  return _operator;
}

export function operatorAddress(): `0x${string}` {
  return privateKeyToAccount(OPERATOR_PRIVATE_KEY).address;
}

export function clientForPrivateKey(pk: `0x${string}`): WalletClient {
  const account = privateKeyToAccount(pk);
  return createWalletClient({
    account,
    chain: loanlyChain,
    transport: http(RPC_URL),
  });
}

/**
 * Returns true if the JSON-RPC endpoint responds. Used by API routes to
 * surface a "Chain offline" banner gracefully instead of leaking an EVM
 * connection error to the user.
 */
export async function isChainReachable(): Promise<boolean> {
  try {
    await publicClient().getBlockNumber();
    return true;
  } catch {
    return false;
  }
}
