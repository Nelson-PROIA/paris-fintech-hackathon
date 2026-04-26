/**
 * Resets the chain layer: wipes wallets/contracts/commitments/events from
 * SQLite (so cached addresses don't point at dead contracts), then
 * re-deploys fresh ones. Run after restarting `pnpm chain:node`.
 */
import { spawnSync } from "node:child_process";
import { getDb } from "../lib/db";

const db = getDb();

console.log("Wiping chain-layer rows…");
db.exec(`
  DELETE FROM chain_events;
  DELETE FROM commitments;
  DELETE FROM campaign_contracts;
  DELETE FROM wallets;
`);

console.log("Re-deploying contracts…");
const r = spawnSync(
  "pnpm",
  ["exec", "tsx", "--env-file=.env.local", "scripts/chain-deploy.ts"],
  { stdio: "inherit" }
);
process.exit(r.status ?? 1);
