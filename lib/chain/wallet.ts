import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { parseUnits, formatUnits } from "viem";
import {
  getWalletByUserId,
  insertWallet,
  getUserByClerkId,
  type WalletRow,
} from "@/lib/db";
import { operatorClient, operatorAddress, publicClient } from "./client";
import { OPERATOR_ENCRYPTION_KEY } from "./config";
import { MOCK_EUR_ABI, TOKEN_DECIMALS } from "./abi";
import { requireChainAddresses } from "./config";

const ENCRYPTION_ALGO = "aes-256-gcm";
const STARTER_INVESTOR_BALANCE_EUR = 1_000_000;

/**
 * AES-256-GCM symmetric encryption keyed off `OPERATOR_ENCRYPTION_KEY`.
 * Layout: `<12-byte iv hex>:<16-byte authTag hex>:<ciphertext hex>`.
 *
 * The encryption key is a 32-byte hex string; we slice the first 32 bytes.
 */
function getKey(): Buffer {
  const hex = OPERATOR_ENCRYPTION_KEY.replace(/^0x/, "").padEnd(64, "0");
  return Buffer.from(hex.slice(0, 64), "hex");
}

export function encryptPk(pk: `0x${string}`): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGO, getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(pk.replace(/^0x/, ""), "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptPk(blob: string): `0x${string}` {
  const [ivHex, tagHex, encHex] = blob.split(":");
  if (!ivHex || !tagHex || !encHex) {
    throw new Error("Invalid encrypted PK blob");
  }
  const decipher = createDecipheriv(
    ENCRYPTION_ALGO,
    getKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]);
  return `0x${dec.toString("utf-8")}` as `0x${string}`;
}

/**
 * Lazy-provision a custodial wallet for a Clerk user. New investor wallets
 * are auto-funded with mock EUR so they have something to commit; SMB
 * wallets stay empty until a campaign disburses to them.
 */
export async function getOrCreateWallet(userId: string): Promise<WalletRow> {
  const existing = getWalletByUserId(userId);
  if (existing) return existing;

  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  const encrypted = encryptPk(pk);
  const wallet = insertWallet(userId, account.address, encrypted);

  const user = getUserByClerkId(userId);
  if (user?.type === "investor") {
    await mintStarterBalance(account.address);
  }
  return wallet;
}

export function getWalletPk(userId: string): `0x${string}` {
  const w = getWalletByUserId(userId);
  if (!w) throw new Error(`No wallet for user ${userId}`);
  return decryptPk(w.encrypted_pk);
}

export async function readEurBalance(address: `0x${string}`): Promise<number> {
  const { mockEurAddress } = requireChainAddresses();
  const raw = (await publicClient().readContract({
    address: mockEurAddress,
    abi: MOCK_EUR_ABI,
    functionName: "balanceOf",
    args: [address],
  })) as bigint;
  return Number(formatUnits(raw, TOKEN_DECIMALS));
}

export async function mintStarterBalance(
  address: `0x${string}`,
  amountEur = STARTER_INVESTOR_BALANCE_EUR
): Promise<`0x${string}`> {
  const { mockEurAddress } = requireChainAddresses();
  const op = operatorClient();
  const hash = await op.writeContract({
    address: mockEurAddress,
    abi: MOCK_EUR_ABI,
    functionName: "mint",
    args: [address, parseUnits(String(amountEur), TOKEN_DECIMALS)],
    account: op.account!,
    chain: op.chain,
  });
  await publicClient().waitForTransactionReceipt({ hash });
  return hash;
}

export async function readEthBalance(address: `0x${string}`): Promise<number> {
  const wei = await publicClient().getBalance({ address });
  return Number(wei) / 1e18;
}

/**
 * Tops up native ETH from the operator on a custodial wallet so it can pay
 * for gas. Hardhat's default chain has free gas (we send 1 ETH, plenty for
 * thousands of txs).
 */
export async function fundGasIfNeeded(
  address: `0x${string}`,
  minEth = 0.5
): Promise<void> {
  const balance = await readEthBalance(address);
  if (balance >= minEth) return;
  const op = operatorClient();
  const hash = await op.sendTransaction({
    to: address,
    value: BigInt(1e18),
    account: op.account!,
    chain: op.chain,
  });
  await publicClient().waitForTransactionReceipt({ hash });
}

export function getOperatorAddress(): `0x${string}` {
  return operatorAddress();
}
