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
  `);
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
  created_at: number;
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

export type CreateCampaignInput = Omit<CampaignRow, "id" | "created_at"> & {
  id?: string;
};

export function createCampaign(data: CreateCampaignInput): CampaignRow {
  const db = getDb();
  const id = data.id ?? randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO campaigns (
      id, company_id, title, capital_seeking_eur, use_of_funds,
      pitch_summary, status, created_at
    ) VALUES (
      @id, @company_id, @title, @capital_seeking_eur, @use_of_funds,
      @pitch_summary, @status, @created_at
    )`
  ).run({ ...data, id, created_at: now });
  return getCampaignById(id)!;
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
