import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env.DATABASE_PATH || "./data/hack.db";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const fullPath = path.resolve(DB_PATH);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(fullPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  bootstrap(db);

  _db = db;
  return db;
}

function bootstrap(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('smb','investor')),
      display_name TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      sector TEXT,
      stage TEXT,
      country TEXT,
      city TEXT,
      founded_year INTEGER,
      team_size INTEGER,
      monthly_revenue_eur INTEGER,
      monthly_burn_eur INTEGER,
      pitch TEXT,
      website TEXT,
      rating_avg REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sector);
    CREATE INDEX IF NOT EXISTS idx_companies_country ON companies(country);
    CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id);

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      title TEXT NOT NULL,
      capital_seeking_eur INTEGER NOT NULL,
      use_of_funds TEXT NOT NULL,
      pitch_summary TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed','funded')),
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_campaigns_company ON campaigns(company_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

    CREATE TABLE IF NOT EXISTS collaterals (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id),
      type TEXT NOT NULL CHECK(type IN ('real_estate','equipment','contract','inventory','receivables','other')),
      description TEXT NOT NULL,
      declared_value_eur INTEGER NOT NULL,
      document_filename TEXT,
      document_url TEXT,
      ai_score INTEGER,
      ai_verdict_json TEXT,
      ai_checked_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_collaterals_campaign ON collaterals(campaign_id);

    CREATE TABLE IF NOT EXISTS investors (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      display_name TEXT NOT NULL,
      thesis_text TEXT,
      sectors_json TEXT,
      countries_json TEXT,
      stages_json TEXT,
      ticket_min_eur INTEGER,
      ticket_max_eur INTEGER,
      total_capital_eur INTEGER,
      risk_tolerance TEXT CHECK(risk_tolerance IN ('low','medium','high')),
      rating_avg REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      extracted_json TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dd_briefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(id),
      brief_json TEXT NOT NULL,
      generated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dd_company ON dd_briefs(company_id);

    CREATE TABLE IF NOT EXISTS portfolio_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      investor_id TEXT NOT NULL REFERENCES investors(id),
      query_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rater_user_id TEXT NOT NULL REFERENCES users(id),
      rated_user_id TEXT NOT NULL REFERENCES users(id),
      rated_type TEXT NOT NULL CHECK(rated_type IN ('smb','investor')),
      score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
      dimensions_json TEXT,
      comment TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id),
      investor_id TEXT NOT NULL REFERENCES investors(id),
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_caches (
      investor_id TEXT PRIMARY KEY REFERENCES investors(id),
      result_json TEXT NOT NULL,
      generated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS onboarding_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('smb','investor')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted')),
      data_json TEXT NOT NULL DEFAULT '{}',
      documents_json TEXT NOT NULL DEFAULT '[]',
      enrichment_json TEXT,
      enrichment_status TEXT NOT NULL DEFAULT 'idle'
        CHECK(enrichment_status IN ('idle','running','done','error')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, type)
    );

    CREATE INDEX IF NOT EXISTS idx_onboarding_user ON onboarding_profiles(user_id);

    -- ── Smart-contract layer ────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      address TEXT NOT NULL UNIQUE,
      encrypted_pk TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);

    CREATE TABLE IF NOT EXISTS campaign_contracts (
      campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id),
      borrower_address TEXT NOT NULL,
      target_eur INTEGER NOT NULL,
      interest_bps INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      commit_deadline INTEGER NOT NULL,
      deploy_tx_hash TEXT NOT NULL,
      total_committed_eur INTEGER NOT NULL DEFAULT 0,
      total_repaid_eur INTEGER NOT NULL DEFAULT 0,
      funded_at INTEGER,
      repaid_at INTEGER,
      cancelled_at INTEGER,
      on_chain_state TEXT NOT NULL DEFAULT 'open'
        CHECK(on_chain_state IN ('open','funded','repaying','repaid','cancelled')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_contracts_state ON campaign_contracts(on_chain_state);

    CREATE TABLE IF NOT EXISTS commitments (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id),
      investor_user_id TEXT NOT NULL REFERENCES users(id),
      investor_address TEXT NOT NULL,
      amount_eur INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'committed'
        CHECK(status IN ('committed','refunded','repaid_partial','repaid')),
      repaid_amount_eur INTEGER NOT NULL DEFAULT 0,
      committed_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_commitments_campaign ON commitments(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_commitments_investor ON commitments(investor_user_id);

    CREATE TABLE IF NOT EXISTS chain_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      block_number INTEGER NOT NULL,
      log_index INTEGER NOT NULL DEFAULT 0,
      args_json TEXT NOT NULL,
      ts INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chain_events_campaign ON chain_events(campaign_id, ts);
  `);

  // Idempotent column additions (SQLite doesn't support IF NOT EXISTS on
  // ALTER TABLE ADD COLUMN, so we swallow the duplicate-column error).
  addColumnIfMissing(db, "campaigns", "meta_json", "TEXT");
  addColumnIfMissing(db, "chain_events", "log_index", "INTEGER NOT NULL DEFAULT 0");

  // The original unique index (tx_hash, kind, campaign_id) was too coarse —
  // a single `repay` tx emits one `InvestorPaid` event per investor, which
  // would have been silently deduped. Migrate to (tx_hash, log_index,
  // campaign_id). Pre-migration rows all have log_index=0 so we wipe them to
  // avoid a conflict on the new unique index — they'll be re-indexed from
  // chain on the next read of any campaign that already had a contract.
  const oldDedupeIdx = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='index' AND name='uq_chain_events_dedupe'"
    )
    .get() as { sql?: string } | undefined;
  if (oldDedupeIdx?.sql && !oldDedupeIdx.sql.includes("log_index")) {
    db.exec(`DELETE FROM chain_events;`);
    db.exec(`DROP INDEX IF EXISTS uq_chain_events_dedupe;`);
  }
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_chain_events_dedupe
       ON chain_events(tx_hash, log_index, campaign_id);`
  );
}

function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  type: string
): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate column name/i.test(msg)) throw e;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export type UserType = "smb" | "investor";

export type UserRow = {
  id: string;
  email: string;
  type: UserType;
  display_name: string | null;
  created_at: number;
};

export type CompanyRow = {
  id: string;
  user_id: string;
  name: string;
  sector: string | null;
  stage: string | null;
  country: string | null;
  city: string | null;
  founded_year: number | null;
  team_size: number | null;
  monthly_revenue_eur: number | null;
  monthly_burn_eur: number | null;
  pitch: string | null;
  website: string | null;
  rating_avg: number;
  rating_count: number;
  created_at: number;
};

export type CampaignStatus = "open" | "closed" | "funded";

export type CampaignRow = {
  id: string;
  company_id: string;
  title: string;
  capital_seeking_eur: number;
  use_of_funds: string;
  pitch_summary: string | null;
  status: CampaignStatus;
  /**
   * Free-form JSON describing the financing need (need types, urgency,
   * duration, description, optional doc refs). Decoupled from the company
   * profile, which lives in onboarding_profiles for the SMB.
   */
  meta_json: string | null;
  created_at: number;
};

/**
 * Typed view of CampaignRow.meta_json. Optional fields — older campaigns
 * predating the new flow won't have any of these.
 */
export type CampaignMeta = {
  need_types?: string[];
  urgency?: "very_urgent" | "this_week" | "this_month" | "flexible";
  duration_days?: number;
  need_description?: string;
  /** Optional ids of documents (linked to the SMB's onboarding documents) the user wants to highlight */
  document_ids?: string[];
};

export type CollateralType =
  | "real_estate"
  | "equipment"
  | "contract"
  | "inventory"
  | "receivables"
  | "other";

export type CollateralRow = {
  id: string;
  campaign_id: string;
  type: CollateralType;
  description: string;
  declared_value_eur: number;
  document_filename: string | null;
  document_url: string | null;
  ai_score: number | null;
  ai_verdict_json: string | null;
  ai_checked_at: number | null;
  created_at: number;
};

export type InvestorRow = {
  id: string;
  user_id: string;
  display_name: string;
  thesis_text: string | null;
  sectors_json: string | null;
  countries_json: string | null;
  stages_json: string | null;
  ticket_min_eur: number | null;
  ticket_max_eur: number | null;
  total_capital_eur: number | null;
  risk_tolerance: "low" | "medium" | "high" | null;
  rating_avg: number;
  rating_count: number;
  created_at: number;
};

// Combined view used by feed/portfolio: a campaign with its company info inlined.
export type CampaignWithCompany = CampaignRow & {
  company: CompanyRow;
};

// ── User helpers ─────────────────────────────────────────────────────────────

export function upsertUser(opts: {
  id: string;
  email: string;
  type: UserType;
  displayName?: string | null;
}): UserRow {
  const db = getDb();
  const existing = getUserByClerkId(opts.id);
  if (existing) {
    db.prepare(
      `UPDATE users SET email = ?, type = ?, display_name = ? WHERE id = ?`
    ).run(opts.email, opts.type, opts.displayName ?? null, opts.id);
  } else {
    db.prepare(
      `INSERT INTO users (id, email, type, display_name, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(opts.id, opts.email, opts.type, opts.displayName ?? null, Date.now());
  }
  return getUserByClerkId(opts.id)!;
}

export function getUserByClerkId(id: string): UserRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(id) as UserRow | undefined) ?? null
  );
}

// ── Company helpers ──────────────────────────────────────────────────────────

export type CreateCompanyInput = Omit<
  CompanyRow,
  "id" | "created_at" | "rating_avg" | "rating_count"
> & { id?: string };

export function createCompany(data: CreateCompanyInput): CompanyRow {
  const db = getDb();
  const id = data.id ?? randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO companies (
      id, user_id, name, sector, stage, country, city, founded_year, team_size,
      monthly_revenue_eur, monthly_burn_eur, pitch, website, created_at
    ) VALUES (
      @id, @user_id, @name, @sector, @stage, @country, @city, @founded_year, @team_size,
      @monthly_revenue_eur, @monthly_burn_eur, @pitch, @website, @created_at
    )`
  ).run({ ...data, id, created_at: now });
  return getCompanyById(id)!;
}

export function getCompanyById(id: string): CompanyRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM companies WHERE id = ?")
      .get(id) as CompanyRow | undefined) ?? null
  );
}

export function listCompaniesByUserId(userId: string): CompanyRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC"
    )
    .all(userId) as CompanyRow[];
}

export function listSectors(): string[] {
  const rows = getDb()
    .prepare(
      "SELECT DISTINCT sector FROM companies WHERE sector IS NOT NULL ORDER BY sector"
    )
    .all() as { sector: string }[];
  return rows.map((r) => r.sector);
}

export function listCountries(): string[] {
  const rows = getDb()
    .prepare(
      "SELECT DISTINCT country FROM companies WHERE country IS NOT NULL ORDER BY country"
    )
    .all() as { country: string }[];
  return rows.map((r) => r.country);
}

// ── Campaign helpers ─────────────────────────────────────────────────────────

export type CreateCampaignInput = Omit<
  CampaignRow,
  "id" | "created_at" | "meta_json"
> & {
  id?: string;
  meta_json?: string | null;
};

export function createCampaign(data: CreateCampaignInput): CampaignRow {
  const db = getDb();
  const id = data.id ?? randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO campaigns (
      id, company_id, title, capital_seeking_eur, use_of_funds,
      pitch_summary, status, meta_json, created_at
    ) VALUES (
      @id, @company_id, @title, @capital_seeking_eur, @use_of_funds,
      @pitch_summary, @status, @meta_json, @created_at
    )`
  ).run({
    ...data,
    id,
    meta_json: data.meta_json ?? null,
    created_at: now,
  });
  return getCampaignById(id)!;
}

/**
 * Parse a campaign's meta_json into a typed view. Returns an empty object
 * when null or invalid so callers can spread without checks.
 */
export function parseCampaignMeta(row: CampaignRow): CampaignMeta {
  if (!row.meta_json) return {};
  try {
    const v = JSON.parse(row.meta_json);
    return v && typeof v === "object" ? (v as CampaignMeta) : {};
  } catch {
    return {};
  }
}

export function getCampaignById(id: string): CampaignRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM campaigns WHERE id = ?")
      .get(id) as CampaignRow | undefined) ?? null
  );
}

export function listCampaignsByCompany(companyId: string): CampaignRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM campaigns WHERE company_id = ? ORDER BY created_at DESC"
    )
    .all(companyId) as CampaignRow[];
}

export type CampaignFilters = {
  sectors?: string[];
  countries?: string[];
  ticketMin?: number;
  ticketMax?: number;
  status?: CampaignStatus | "any";
  limit?: number;
};

export function listCampaigns(
  filters: CampaignFilters = {}
): CampaignWithCompany[] {
  const where: string[] = ["camp.status = 'open'"];
  const params: (string | number)[] = [];

  if (filters.status && filters.status !== "any") {
    where[0] = `camp.status = ?`;
    params.push(filters.status);
  }

  if (filters.sectors?.length) {
    where.push(
      `co.sector IN (${filters.sectors.map(() => "?").join(",")})`
    );
    params.push(...filters.sectors);
  }
  if (filters.countries?.length) {
    where.push(
      `co.country IN (${filters.countries.map(() => "?").join(",")})`
    );
    params.push(...filters.countries);
  }
  if (filters.ticketMin != null) {
    where.push("camp.capital_seeking_eur >= ?");
    params.push(filters.ticketMin);
  }
  if (filters.ticketMax != null) {
    where.push("camp.capital_seeking_eur <= ?");
    params.push(filters.ticketMax);
  }

  const limit = filters.limit ?? 200;
  const sql = `
    SELECT
      camp.id            AS id,
      camp.company_id    AS company_id,
      camp.title         AS title,
      camp.capital_seeking_eur AS capital_seeking_eur,
      camp.use_of_funds  AS use_of_funds,
      camp.pitch_summary AS pitch_summary,
      camp.status        AS status,
      camp.meta_json     AS meta_json,
      camp.created_at    AS created_at,
      co.id              AS co_id,
      co.user_id         AS co_user_id,
      co.name            AS co_name,
      co.sector          AS co_sector,
      co.stage           AS co_stage,
      co.country         AS co_country,
      co.city            AS co_city,
      co.founded_year    AS co_founded_year,
      co.team_size       AS co_team_size,
      co.monthly_revenue_eur AS co_monthly_revenue_eur,
      co.monthly_burn_eur    AS co_monthly_burn_eur,
      co.pitch           AS co_pitch,
      co.website         AS co_website,
      co.rating_avg      AS co_rating_avg,
      co.rating_count    AS co_rating_count,
      co.created_at      AS co_created_at
    FROM campaigns camp
    JOIN companies co ON co.id = camp.company_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY camp.created_at DESC
    LIMIT ?`;

  const rows = getDb()
    .prepare(sql)
    .all(...params, limit) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: r.id as string,
    company_id: r.company_id as string,
    title: r.title as string,
    capital_seeking_eur: r.capital_seeking_eur as number,
    use_of_funds: r.use_of_funds as string,
    pitch_summary: (r.pitch_summary as string) ?? null,
    status: r.status as CampaignStatus,
    meta_json: (r.meta_json as string | null) ?? null,
    created_at: r.created_at as number,
    company: {
      id: r.co_id as string,
      user_id: r.co_user_id as string,
      name: r.co_name as string,
      sector: (r.co_sector as string) ?? null,
      stage: (r.co_stage as string) ?? null,
      country: (r.co_country as string) ?? null,
      city: (r.co_city as string) ?? null,
      founded_year: (r.co_founded_year as number) ?? null,
      team_size: (r.co_team_size as number) ?? null,
      monthly_revenue_eur: (r.co_monthly_revenue_eur as number) ?? null,
      monthly_burn_eur: (r.co_monthly_burn_eur as number) ?? null,
      pitch: (r.co_pitch as string) ?? null,
      website: (r.co_website as string) ?? null,
      rating_avg: r.co_rating_avg as number,
      rating_count: r.co_rating_count as number,
      created_at: r.co_created_at as number,
    },
  }));
}

export function getCampaignWithCompany(
  campaignId: string
): CampaignWithCompany | null {
  const camp = getCampaignById(campaignId);
  if (!camp) return null;
  const company = getCompanyById(camp.company_id);
  if (!company) return null;
  return { ...camp, company };
}

// ── Collateral helpers ───────────────────────────────────────────────────────

export type CreateCollateralInput = Omit<
  CollateralRow,
  | "id"
  | "created_at"
  | "ai_score"
  | "ai_verdict_json"
  | "ai_checked_at"
> & {
  id?: string;
};

export function createCollateral(
  data: CreateCollateralInput
): CollateralRow {
  const db = getDb();
  const id = data.id ?? randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO collaterals (
      id, campaign_id, type, description, declared_value_eur,
      document_filename, document_url, created_at
    ) VALUES (
      @id, @campaign_id, @type, @description, @declared_value_eur,
      @document_filename, @document_url, @created_at
    )`
  ).run({ ...data, id, created_at: now });
  return getCollateralById(id)!;
}

export function getCollateralById(id: string): CollateralRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM collaterals WHERE id = ?")
      .get(id) as CollateralRow | undefined) ?? null
  );
}

export function listCollateralsByCampaign(
  campaignId: string
): CollateralRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM collaterals WHERE campaign_id = ? ORDER BY created_at DESC"
    )
    .all(campaignId) as CollateralRow[];
}

export function setCollateralVerdict(
  id: string,
  score: number,
  verdict: unknown
): void {
  getDb()
    .prepare(
      "UPDATE collaterals SET ai_score = ?, ai_verdict_json = ?, ai_checked_at = ? WHERE id = ?"
    )
    .run(score, JSON.stringify(verdict), Date.now(), id);
}

// ── Investor helpers ─────────────────────────────────────────────────────────

export function getInvestorByUserId(userId: string): InvestorRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM investors WHERE user_id = ?")
      .get(userId) as InvestorRow | undefined) ?? null
  );
}

export type CreateInvestorInput = {
  id?: string;
  user_id: string;
  display_name: string;
  thesis_text?: string | null;
  sectors_json?: string | null;
  countries_json?: string | null;
  stages_json?: string | null;
  ticket_min_eur?: number | null;
  ticket_max_eur?: number | null;
  total_capital_eur?: number | null;
  risk_tolerance?: "low" | "medium" | "high" | null;
};

export function createInvestor(data: CreateInvestorInput): InvestorRow {
  const db = getDb();
  const id = data.id ?? randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO investors (
      id, user_id, display_name, thesis_text,
      sectors_json, countries_json, stages_json,
      ticket_min_eur, ticket_max_eur, total_capital_eur,
      risk_tolerance, created_at
    ) VALUES (
      @id, @user_id, @display_name, @thesis_text,
      @sectors_json, @countries_json, @stages_json,
      @ticket_min_eur, @ticket_max_eur, @total_capital_eur,
      @risk_tolerance, @created_at
    )`
  ).run({
    id,
    user_id: data.user_id,
    display_name: data.display_name,
    thesis_text: data.thesis_text ?? null,
    sectors_json: data.sectors_json ?? null,
    countries_json: data.countries_json ?? null,
    stages_json: data.stages_json ?? null,
    ticket_min_eur: data.ticket_min_eur ?? null,
    ticket_max_eur: data.ticket_max_eur ?? null,
    total_capital_eur: data.total_capital_eur ?? null,
    risk_tolerance: data.risk_tolerance ?? null,
    created_at: now,
  });
  return getDb()
    .prepare("SELECT * FROM investors WHERE id = ?")
    .get(id) as InvestorRow;
}

export function getOrCreateInvestor(
  userId: string,
  displayName: string
): InvestorRow {
  const existing = getInvestorByUserId(userId);
  if (existing) return existing;
  return createInvestor({ user_id: userId, display_name: displayName });
}

export function updateInvestorThesis(
  userId: string,
  patch: Partial<
    Omit<InvestorRow, "id" | "user_id" | "created_at" | "rating_avg" | "rating_count">
  >
): InvestorRow {
  const db = getDb();
  const existing = getInvestorByUserId(userId);
  if (!existing) throw new Error("investor row missing");

  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(patch)) {
    setClauses.push(`${k} = ?`);
    params.push(v as string | number | null);
  }
  if (!setClauses.length) return existing;
  params.push(existing.id);
  db.prepare(
    `UPDATE investors SET ${setClauses.join(", ")} WHERE id = ?`
  ).run(...params);
  return getInvestorByUserId(userId)!;
}

// ── Ratings ──────────────────────────────────────────────────────────────────

export function submitRating(opts: {
  raterUserId: string;
  ratedUserId: string;
  ratedType: "smb" | "investor";
  score: number;
  dimensions?: Record<string, number>;
  comment?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO ratings (rater_user_id, rated_user_id, rated_type, score, dimensions_json, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    opts.raterUserId,
    opts.ratedUserId,
    opts.ratedType,
    opts.score,
    opts.dimensions ? JSON.stringify(opts.dimensions) : null,
    opts.comment ?? null,
    Date.now()
  );

  // Refresh aggregate on the rated user's row in companies/investors.
  if (opts.ratedType === "smb") {
    db.prepare(
      `UPDATE companies SET
        rating_avg = (SELECT AVG(score) FROM ratings WHERE rated_user_id = companies.user_id AND rated_type = 'smb'),
        rating_count = (SELECT COUNT(*) FROM ratings WHERE rated_user_id = companies.user_id AND rated_type = 'smb')
       WHERE user_id = ?`
    ).run(opts.ratedUserId);
  } else {
    db.prepare(
      `UPDATE investors SET
        rating_avg = (SELECT AVG(score) FROM ratings WHERE rated_user_id = investors.user_id AND rated_type = 'investor'),
        rating_count = (SELECT COUNT(*) FROM ratings WHERE rated_user_id = investors.user_id AND rated_type = 'investor')
       WHERE user_id = ?`
    ).run(opts.ratedUserId);
  }
}

export type RatingRow = {
  id: number;
  rater_user_id: string;
  rated_user_id: string;
  rated_type: "smb" | "investor";
  score: number;
  dimensions_json: string | null;
  comment: string | null;
  created_at: number;
};

export function listRatingsForUser(userId: string): RatingRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM ratings WHERE rated_user_id = ? ORDER BY created_at DESC LIMIT 20"
    )
    .all(userId) as RatingRow[];
}

// ── Onboarding profiles ──────────────────────────────────────────────────────

export type OnboardingType = "smb" | "investor";
export type OnboardingStatus = "draft" | "submitted";
export type EnrichmentStatus = "idle" | "running" | "done" | "error";

export type OnboardingProfileRow = {
  id: string;
  user_id: string;
  type: OnboardingType;
  status: OnboardingStatus;
  data_json: string;
  documents_json: string;
  enrichment_json: string | null;
  enrichment_status: EnrichmentStatus;
  created_at: number;
  updated_at: number;
};

export type OnboardingDocument = {
  id: string;
  filename: string;
  url: string;
  mime: string;
  size: number;
  category: string | null;
  uploaded_at: number;
};

export function getOnboardingProfile(
  userId: string,
  type: OnboardingType
): OnboardingProfileRow | null {
  return (
    (getDb()
      .prepare(
        "SELECT * FROM onboarding_profiles WHERE user_id = ? AND type = ?"
      )
      .get(userId, type) as OnboardingProfileRow | undefined) ?? null
  );
}

export function ensureOnboardingProfile(
  userId: string,
  type: OnboardingType
): OnboardingProfileRow {
  const existing = getOnboardingProfile(userId, type);
  if (existing) return existing;
  const id = randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO onboarding_profiles
         (id, user_id, type, status, data_json, documents_json, enrichment_json, enrichment_status, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', '{}', '[]', NULL, 'idle', ?, ?)`
    )
    .run(id, userId, type, now, now);
  return getOnboardingProfile(userId, type)!;
}

export function mergeOnboardingData(
  userId: string,
  type: OnboardingType,
  patch: Record<string, unknown>
): OnboardingProfileRow {
  const profile = ensureOnboardingProfile(userId, type);
  const current = safeJson<Record<string, unknown>>(profile.data_json, {});
  const merged = { ...current, ...patch };
  getDb()
    .prepare(
      "UPDATE onboarding_profiles SET data_json = ?, updated_at = ? WHERE id = ?"
    )
    .run(JSON.stringify(merged), Date.now(), profile.id);
  return getOnboardingProfile(userId, type)!;
}

export function appendOnboardingDocument(
  userId: string,
  type: OnboardingType,
  doc: OnboardingDocument
): OnboardingProfileRow {
  const profile = ensureOnboardingProfile(userId, type);
  const docs = safeJson<OnboardingDocument[]>(profile.documents_json, []);
  docs.push(doc);
  getDb()
    .prepare(
      "UPDATE onboarding_profiles SET documents_json = ?, updated_at = ? WHERE id = ?"
    )
    .run(JSON.stringify(docs), Date.now(), profile.id);
  return getOnboardingProfile(userId, type)!;
}

export function updateOnboardingDocument(
  userId: string,
  type: OnboardingType,
  documentId: string,
  patch: Partial<Pick<OnboardingDocument, "category">>
): OnboardingProfileRow {
  const profile = ensureOnboardingProfile(userId, type);
  const docs = safeJson<OnboardingDocument[]>(profile.documents_json, []);
  const next = docs.map((d) =>
    d.id === documentId ? { ...d, ...patch } : d
  );
  getDb()
    .prepare(
      "UPDATE onboarding_profiles SET documents_json = ?, updated_at = ? WHERE id = ?"
    )
    .run(JSON.stringify(next), Date.now(), profile.id);
  return getOnboardingProfile(userId, type)!;
}

export function setEnrichmentStatus(
  userId: string,
  type: OnboardingType,
  status: EnrichmentStatus
): void {
  const profile = ensureOnboardingProfile(userId, type);
  getDb()
    .prepare(
      "UPDATE onboarding_profiles SET enrichment_status = ?, updated_at = ? WHERE id = ?"
    )
    .run(status, Date.now(), profile.id);
}

export function setEnrichmentResult(
  userId: string,
  type: OnboardingType,
  result: unknown,
  status: EnrichmentStatus = "done"
): void {
  const profile = ensureOnboardingProfile(userId, type);
  getDb()
    .prepare(
      "UPDATE onboarding_profiles SET enrichment_json = ?, enrichment_status = ?, updated_at = ? WHERE id = ?"
    )
    .run(JSON.stringify(result), status, Date.now(), profile.id);
}

/**
 * Resolve the SMB onboarding profile for a given company id by joining through
 * the company's user_id. Used by the lender-facing campaign view to surface
 * rich profile data.
 */
export function getOnboardingForCompany(
  companyId: string
): OnboardingProfileRow | null {
  const co = getCompanyById(companyId);
  if (!co) return null;
  return getOnboardingProfile(co.user_id, "smb");
}

export function markOnboardingSubmitted(
  userId: string,
  type: OnboardingType
): void {
  const profile = ensureOnboardingProfile(userId, type);
  getDb()
    .prepare(
      "UPDATE onboarding_profiles SET status = 'submitted', updated_at = ? WHERE id = ?"
    )
    .run(Date.now(), profile.id);
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── Smart-contract layer ────────────────────────────────────────────────────

export type WalletRow = {
  user_id: string;
  address: string;
  encrypted_pk: string;
  created_at: number;
};

export function getWalletByUserId(userId: string): WalletRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM wallets WHERE user_id = ?")
      .get(userId) as WalletRow | undefined) ?? null
  );
}

export function insertWallet(
  userId: string,
  address: string,
  encryptedPk: string
): WalletRow {
  getDb()
    .prepare(
      `INSERT INTO wallets (user_id, address, encrypted_pk, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, address, encryptedPk, Date.now());
  return getWalletByUserId(userId)!;
}

export function getWalletByAddress(address: string): WalletRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM wallets WHERE LOWER(address) = LOWER(?)")
      .get(address) as WalletRow | undefined) ?? null
  );
}

export type OnChainState =
  | "open"
  | "funded"
  | "repaying"
  | "repaid"
  | "cancelled";

export type CampaignContractRow = {
  campaign_id: string;
  borrower_address: string;
  target_eur: number;
  interest_bps: number;
  duration_days: number;
  commit_deadline: number;
  deploy_tx_hash: string;
  total_committed_eur: number;
  total_repaid_eur: number;
  funded_at: number | null;
  repaid_at: number | null;
  cancelled_at: number | null;
  on_chain_state: OnChainState;
  created_at: number;
  updated_at: number;
};

export function getCampaignContract(
  campaignId: string
): CampaignContractRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM campaign_contracts WHERE campaign_id = ?")
      .get(campaignId) as CampaignContractRow | undefined) ?? null
  );
}

export type CreateCampaignContractInput = {
  campaign_id: string;
  borrower_address: string;
  target_eur: number;
  interest_bps: number;
  duration_days: number;
  commit_deadline: number;
  deploy_tx_hash: string;
};

export function insertCampaignContract(
  data: CreateCampaignContractInput
): CampaignContractRow {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO campaign_contracts (
        campaign_id, borrower_address, target_eur, interest_bps,
        duration_days, commit_deadline, deploy_tx_hash,
        total_committed_eur, total_repaid_eur,
        funded_at, repaid_at, cancelled_at,
        on_chain_state, created_at, updated_at
      ) VALUES (
        @campaign_id, @borrower_address, @target_eur, @interest_bps,
        @duration_days, @commit_deadline, @deploy_tx_hash,
        0, 0,
        NULL, NULL, NULL,
        'open', @created_at, @updated_at
      )`
    )
    .run({ ...data, created_at: now, updated_at: now });
  return getCampaignContract(data.campaign_id)!;
}

export type CampaignContractPatch = Partial<
  Pick<
    CampaignContractRow,
    | "total_committed_eur"
    | "total_repaid_eur"
    | "funded_at"
    | "repaid_at"
    | "cancelled_at"
    | "on_chain_state"
  >
>;

export function updateCampaignContract(
  campaignId: string,
  patch: CampaignContractPatch
): CampaignContractRow | null {
  const existing = getCampaignContract(campaignId);
  if (!existing) return null;
  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(patch)) {
    setClauses.push(`${k} = ?`);
    params.push(v as string | number | null);
  }
  if (setClauses.length === 0) return existing;
  setClauses.push("updated_at = ?");
  params.push(Date.now());
  params.push(campaignId);
  getDb()
    .prepare(
      `UPDATE campaign_contracts SET ${setClauses.join(", ")} WHERE campaign_id = ?`
    )
    .run(...params);
  return getCampaignContract(campaignId);
}

export function listOpenCampaignContracts(): CampaignContractRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM campaign_contracts WHERE on_chain_state IN ('open','funded','repaying') ORDER BY updated_at DESC`
    )
    .all() as CampaignContractRow[];
}

export function listCampaignContractsByIds(
  campaignIds: string[]
): Map<string, CampaignContractRow> {
  if (campaignIds.length === 0) return new Map();
  const placeholders = campaignIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT * FROM campaign_contracts WHERE campaign_id IN (${placeholders})`
    )
    .all(...campaignIds) as CampaignContractRow[];
  return new Map(rows.map((r) => [r.campaign_id, r]));
}

export type CommitmentStatus =
  | "committed"
  | "refunded"
  | "repaid_partial"
  | "repaid";

export type CommitmentRow = {
  id: string;
  campaign_id: string;
  investor_user_id: string;
  investor_address: string;
  amount_eur: number;
  tx_hash: string;
  status: CommitmentStatus;
  repaid_amount_eur: number;
  committed_at: number;
  updated_at: number;
};

export type CreateCommitmentInput = {
  id?: string;
  campaign_id: string;
  investor_user_id: string;
  investor_address: string;
  amount_eur: number;
  tx_hash: string;
};

export function insertCommitment(
  data: CreateCommitmentInput
): CommitmentRow {
  const id = data.id ?? randomUUID();
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO commitments (
        id, campaign_id, investor_user_id, investor_address,
        amount_eur, tx_hash, status, repaid_amount_eur,
        committed_at, updated_at
      ) VALUES (
        @id, @campaign_id, @investor_user_id, @investor_address,
        @amount_eur, @tx_hash, 'committed', 0,
        @now, @now
      )`
    )
    .run({ ...data, id, now });
  return getCommitmentById(id)!;
}

export function getCommitmentById(id: string): CommitmentRow | null {
  return (
    (getDb()
      .prepare("SELECT * FROM commitments WHERE id = ?")
      .get(id) as CommitmentRow | undefined) ?? null
  );
}

export function listCommitmentsByCampaign(campaignId: string): CommitmentRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM commitments WHERE campaign_id = ? ORDER BY committed_at ASC"
    )
    .all(campaignId) as CommitmentRow[];
}

export function listCommitmentsByInvestor(
  investorUserId: string
): CommitmentRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM commitments WHERE investor_user_id = ? ORDER BY committed_at DESC"
    )
    .all(investorUserId) as CommitmentRow[];
}

export function updateCommitment(
  id: string,
  patch: Partial<Pick<CommitmentRow, "status" | "repaid_amount_eur">>
): void {
  const setClauses: string[] = [];
  const params: (string | number)[] = [];
  for (const [k, v] of Object.entries(patch)) {
    setClauses.push(`${k} = ?`);
    params.push(v as string | number);
  }
  if (setClauses.length === 0) return;
  setClauses.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);
  getDb()
    .prepare(`UPDATE commitments SET ${setClauses.join(", ")} WHERE id = ?`)
    .run(...params);
}

export type ChainEventKind =
  | "CampaignCreated"
  | "Committed"
  | "Funded"
  | "RepaymentReceived"
  | "InvestorPaid"
  | "InvestorRefunded"
  | "Repaid"
  | "Cancelled";

export type ChainEventRow = {
  id: number;
  campaign_id: string;
  kind: ChainEventKind;
  tx_hash: string;
  block_number: number;
  log_index: number;
  args_json: string;
  ts: number;
};

export function insertChainEvent(opts: {
  campaignId: string;
  kind: ChainEventKind;
  txHash: string;
  blockNumber: number;
  logIndex?: number;
  args: unknown;
  ts?: number;
}): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO chain_events (campaign_id, kind, tx_hash, block_number, log_index, args_json, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        opts.campaignId,
        opts.kind,
        opts.txHash,
        opts.blockNumber,
        opts.logIndex ?? 0,
        JSON.stringify(opts.args ?? {}),
        opts.ts ?? Date.now()
      );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/UNIQUE constraint failed/i.test(msg)) throw e;
  }
}

export function listChainEventsByCampaign(
  campaignId: string,
  limit = 50
): ChainEventRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM chain_events WHERE campaign_id = ? ORDER BY ts ASC, id ASC LIMIT ?"
    )
    .all(campaignId, limit) as ChainEventRow[];
}
