import { getDb } from "../lib/db";

const db = getDb();
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all() as { name: string }[];

console.log(`DB ready at ${process.env.DATABASE_PATH || "./data/hack.db"}`);
console.log(`Tables: ${tables.map((t) => t.name).join(", ")}`);
