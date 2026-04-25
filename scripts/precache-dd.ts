import { runDDAgent } from "../lib/ai/dd-analyst";
import { getCompanyById, getDb, listCampaignsByCompany } from "../lib/db";

const HERO_IDS = ["hero-atelier-paris", "hero-meridian-saas"];

async function main() {
  const db = getDb();
  for (const id of HERO_IDS) {
    const company = getCompanyById(id);
    if (!company) {
      console.warn(`[precache-dd] missing company ${id}`);
      continue;
    }
    const campaigns = listCampaignsByCompany(id);
    console.log(
      `[precache-dd] running DD agent for ${id} (${company.name}, ${campaigns.length} campaign(s))…`
    );
    const t0 = Date.now();
    try {
      const brief = await runDDAgent({ company, campaigns });
      db.prepare(
        "INSERT INTO dd_briefs (company_id, brief_json, generated_at) VALUES (?, ?, ?)"
      ).run(id, JSON.stringify(brief), Date.now());
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `[precache-dd] ✓ ${id}: sentiment ${brief.sentimentScore}, ${brief.riskFlags.length} risks, ${brief.evidence.length} sources (${elapsed}s)`
      );
    } catch (e) {
      console.error(
        `[precache-dd] ✗ ${id}:`,
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}

main();
