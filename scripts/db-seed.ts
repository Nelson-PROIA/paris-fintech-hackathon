import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  getDb,
  upsertUser,
  createCompany,
  createCampaign,
  createInvestor,
} from "../lib/db";
import { writePdf } from "./_pdf";

const db = getDb();
const UPLOAD_DIR = path.resolve(process.cwd(), "data/uploads");

console.log("Wiping seed rows…");
db.exec(`
  DELETE FROM collaterals WHERE campaign_id IN (SELECT id FROM campaigns WHERE company_id IN (SELECT id FROM companies WHERE user_id LIKE 'seed-%'));
  DELETE FROM campaigns WHERE company_id IN (SELECT id FROM companies WHERE user_id LIKE 'seed-%');
  DELETE FROM companies WHERE user_id LIKE 'seed-%';
  DELETE FROM investors WHERE user_id LIKE 'seed-%';
  DELETE FROM users WHERE id LIKE 'seed-%';
`);

type CollateralSeed = {
  type: "real_estate" | "equipment" | "contract" | "inventory" | "receivables" | "other";
  description: string;
  declared_value_eur: number;
  /** PDF body — first line becomes title, rest body. Used for AI-readable doc. */
  document: { title: string; lines: string[] };
  /** Pre-baked AI verdict so the demo shows verification immediately. */
  verdict: {
    documentRecognised: boolean;
    documentType: string | null;
    matchesClaim: "yes" | "partial" | "no" | "unclear";
    valuePlausible: "yes" | "ambiguous" | "no" | "unclear";
    redFlags: string[];
    summary: string;
    confidenceScore: number;
  };
};

type CampaignSeed = {
  id?: string;
  title: string;
  capital_seeking_eur: number;
  use_of_funds: string;
  pitch_summary: string;
  collaterals?: CollateralSeed[];
};

type CompanySeed = {
  id: string;
  display_name: string;
  email: string;
  name: string;
  sector: string;
  stage: "pre_revenue" | "early" | "growth";
  country: string;
  city: string;
  founded_year: number;
  team_size: number;
  monthly_revenue_eur: number | null;
  monthly_burn_eur: number;
  pitch: string;
  website: string | null;
  campaigns: CampaignSeed[];
};

const COMPANIES: CompanySeed[] = [
  {
    id: "hero-atelier-paris",
    display_name: "Marc Lefevre",
    email: "marc@atelierparis.coffee",
    name: "Atelier Paris Coffee Roasters",
    sector: "manufacturing",
    stage: "growth",
    country: "FR",
    city: "Paris",
    founded_year: 2018,
    team_size: 12,
    monthly_revenue_eur: 85000,
    monthly_burn_eur: 65000,
    pitch:
      "Atelier Paris is a specialty coffee roaster founded in 2018 by Marc Lefevre, previously head of sourcing for Starbucks Europe. The company operates a 240sqm roastery in the 11th arrondissement and supplies more than 80 independent Paris cafes and 15 corporate accounts (Doctolib, Alan, BlaBlaCar). Revenue is €85k MRR with 12% MoM growth sustained for 6 months, gross margin 58%, and a 12-person team including two trained Q-graders. Inputs are sourced direct-trade from 6 origin farms in Ethiopia, Colombia and Guatemala. The next 18 months focus on a Lyon roastery to serve the south-east corporate market and on a B2B sales team to convert the 40-account waitlist accumulated through inbound only.",
    website: "https://atelierparis.coffee",
    campaigns: [
      {
        id: "hero-atelier-paris-c1",
        title: "Lyon roastery + B2B sales team (€350k)",
        capital_seeking_eur: 350000,
        use_of_funds:
          "Open second roasting facility in Lyon (€220k), hire 3 B2B sales reps (€90k), wholesale inventory buffer (€40k).",
        pitch_summary:
          "Specialty coffee roaster supplying 80+ Paris cafes and 15 corporate accounts. €85k MRR, growing 12% MoM for 6 months, gross margin 58%. €350k unlocks a Lyon roastery and a 3-person B2B sales team to convert the 40-account inbound waitlist.",
        collaterals: [
          {
            type: "equipment",
            description: "Probat P25 roaster (2022, owned outright)",
            declared_value_eur: 78000,
            document: {
              title: "Equipment valuation - Probat P25",
              lines: [
                "Issued by: Cafetiers SAS - certified equipment appraisal",
                "Date: 2026-02-18",
                "Asset: Probat P25 commercial roaster, 25kg/batch capacity",
                "Year of manufacture: 2022, single owner since new",
                "Condition: excellent, 980 hours of use, full service log",
                "Serial number: PB-25-A-0142",
                "Fair market value: 78,000 EUR",
                "Replacement cost (new): 96,500 EUR",
                "Located at: 47 rue Saint-Maur, 75011 Paris (Atelier Paris main roastery)",
                "Note: appraisal performed on-site by Cafetiers SAS (RCS Paris 814 322 901)",
              ],
            },
            verdict: {
              documentRecognised: true,
              documentType: "third-party equipment appraisal",
              matchesClaim: "yes",
              valuePlausible: "yes",
              redFlags: [],
              summary:
                "Independent appraisal from Cafetiers SAS confirms a 2022 Probat P25 roaster owned outright by Atelier Paris. Declared value of 78,000 EUR matches the appraised fair market value exactly; replacement cost (96,500 EUR) sets a reasonable upper bound. Asset is on-site at the rue Saint-Maur roastery.",
              confidenceScore: 88,
            },
          },
          {
            type: "receivables",
            description: "B2B accounts receivable book (60 active customers)",
            declared_value_eur: 142000,
            document: {
              title: "Aged receivables report Q1 2026",
              lines: [
                "Atelier Paris Coffee Roasters",
                "Period: 2026-01-01 to 2026-03-31",
                "Total open receivables: 142,318 EUR across 60 customers",
                "Aging buckets:",
                "  0-30 days: 88,210 EUR (62%)",
                "  31-60 days: 41,540 EUR (29%)",
                "  61-90 days: 9,820 EUR (7%)",
                "  90+ days: 2,748 EUR (2%)",
                "Top 5 customer concentration: 31% (Doctolib, Alan, BlaBlaCar, Cafe de Flore, Le Pain Quotidien)",
                "Bad debt written off in last 12 months: 1,210 EUR (0.6% of revenue)",
                "Report extracted from Pennylane on 2026-04-02",
              ],
            },
            verdict: {
              documentRecognised: true,
              documentType: "aged receivables report",
              matchesClaim: "yes",
              valuePlausible: "yes",
              redFlags: [
                "2,748 EUR (2%) sitting in 90+ day bucket — small but worth checking the 1-2 customers behind it.",
              ],
              summary:
                "Pennylane-exported aged receivables report supports a 142,318 EUR book — within 0.2% of the 142,000 EUR claim. Aging is clean (62% under 30 days), bad-debt history is healthy (0.6% of revenue), and customer concentration of 31% across 5 accounts is moderate.",
              confidenceScore: 84,
            },
          },
        ],
      },
    ],
  },
  {
    id: "hero-meridian-saas",
    display_name: "Sophie Martin",
    email: "sophie@meridian.tools",
    name: "Meridian Compliance Tools",
    sector: "saas_micro",
    stage: "early",
    country: "FR",
    city: "Lille",
    founded_year: 2022,
    team_size: 5,
    monthly_revenue_eur: 22000,
    monthly_burn_eur: 35000,
    pitch:
      "Meridian Compliance Tools is a GDPR-compliance copilot for European mid-market companies (50-500 employees). Co-founded in 2022 by Sophie Martin (ex-OVH cloud security lead, 8y) and Adrien Petit (ex-OVH staff SRE, 11y). The product ingests data inventories from Notion, GDrive, Slack, Linear and Salesforce, then surfaces non-compliant flows (PII in logs, retention violations, untracked sub-processors) with one-click remediation snippets. €22k MRR across 38 paying customers (avg ACV €580/mo), net dollar retention 118%, monthly logo churn below 2%. Three months of free time on the AWS European Activate program. The 18-month roadmap is gated on shipping ML auto-redaction (the #1 customer ask) and extending runway to reach €60k MRR self-sustainably.",
    website: "https://meridian.tools",
    campaigns: [
      {
        id: "hero-meridian-saas-c1",
        title: "Runway extension + ML hire (€200k)",
        capital_seeking_eur: 200000,
        use_of_funds:
          "18-month runway extension to reach €60k MRR (€140k), hire one ML engineer for the auto-redact feature (€60k).",
        pitch_summary:
          "GDPR-compliance copilot for European mid-market. €22k MRR across 38 paying customers, NDR 118%, monthly logo churn under 2%. €200k extends runway 18 months and funds an ML hire for the auto-redact feature 11 customers have explicitly asked for.",
        collaterals: [
          {
            type: "contract",
            description: "Annual SaaS contract — Doctrine.fr (€36,000/yr)",
            declared_value_eur: 36000,
            document: {
              title: "Annual SaaS subscription agreement",
              lines: [
                "Customer: Doctrine SAS (RCS Paris 808 102 119)",
                "Vendor: Meridian Compliance SAS",
                "Effective date: 2026-01-15",
                "Term: 12 months, auto-renewing 12-month cycles",
                "Subscription fee: 3,000 EUR per month (36,000 EUR annual)",
                "Plan: Meridian Pro - 200 monitored data sources",
                "Payment terms: NET 30, monthly invoicing",
                "Termination: either party with 90 days written notice before renewal",
                "Signed by: Antoine Dussaut (Doctrine, CTO), Sophie Martin (Meridian, CEO)",
              ],
            },
            verdict: {
              documentRecognised: true,
              documentType: "SaaS subscription contract",
              matchesClaim: "yes",
              valuePlausible: "yes",
              redFlags: [],
              summary:
                "Counter-signed 12-month SaaS contract with Doctrine SAS at 3,000 EUR/month auto-renewing. Annual value matches the 36,000 EUR claim exactly. Standard 90-day notice termination — slight contraction risk, but counterparty (Doctrine) is well-known and creditworthy.",
              confidenceScore: 86,
            },
          },
        ],
      },
    ],
  },
  {
    id: "smb-north-loop",
    display_name: "Pieter Van Der Berg",
    email: "pieter@northloop.bike",
    name: "North Loop Bikes",
    sector: "makers",
    stage: "growth",
    country: "NL",
    city: "Utrecht",
    founded_year: 2017,
    team_size: 22,
    monthly_revenue_eur: 140000,
    monthly_burn_eur: 110000,
    pitch:
      "Sustainable cargo-bike manufacturer for last-mile delivery. €1.7M revenue last 12 months, 28% gross margins.",
    website: "https://northloop.bike",
    campaigns: [
      {
        title: "Tooling + B2B inventory (€500k)",
        capital_seeking_eur: 500000,
        use_of_funds:
          "Tooling upgrade for 4x throughput (€300k), 6-month inventory for new B2B accounts (€200k).",
        pitch_summary:
          "Sustainable cargo-bike manufacturer for last-mile delivery. €1.7M revenue, selling to PostNL and 8 city councils. Production capacity-constrained.",
      },
    ],
  },
  {
    id: "smb-studio-belvedere",
    display_name: "Giulia Romano",
    email: "giulia@studiobelvedere.it",
    name: "Studio Belvedere",
    sector: "agency",
    stage: "early",
    country: "IT",
    city: "Milano",
    founded_year: 2021,
    team_size: 8,
    monthly_revenue_eur: 45000,
    monthly_burn_eur: 38000,
    pitch:
      "Boutique brand-design studio working with mid-cap Italian fashion and food brands. Founder previously at Pentagram.",
    website: "https://studiobelvedere.it",
    campaigns: [
      {
        title: "Senior creatives + working capital (€150k)",
        capital_seeking_eur: 150000,
        use_of_funds:
          "Hire 2 senior creative directors to move upmarket; 6-month working capital.",
        pitch_summary:
          "Boutique brand-design studio. €540k revenue last year, 22% net margins. Looking to grow team to 14 and target larger retainers.",
      },
    ],
  },
  {
    id: "smb-taberna-eu",
    display_name: "Carlos Sanchez",
    email: "carlos@taberna.eu",
    name: "Taberna",
    sector: "retail",
    stage: "early",
    country: "ES",
    city: "Madrid",
    founded_year: 2020,
    team_size: 18,
    monthly_revenue_eur: 95000,
    monthly_burn_eur: 90000,
    pitch:
      "Cloud-kitchen group producing tapas-format meals for delivery via Glovo, Uber Eats, and own app.",
    website: "https://taberna.eu",
    campaigns: [
      {
        title: "Barcelona expansion (€250k)",
        capital_seeking_eur: 250000,
        use_of_funds: "Open third cloud-kitchen unit in Barcelona, marketing.",
        pitch_summary:
          "Cloud-kitchen group with two units in Madrid. €1.1M ARR. Targeting Barcelona expansion.",
      },
    ],
  },
  {
    id: "smb-forge-mecanique",
    display_name: "Luc Berger",
    email: "luc@forge-mecanique.fr",
    name: "Forge Mécanique",
    sector: "manufacturing",
    stage: "growth",
    country: "FR",
    city: "Toulouse",
    founded_year: 2009,
    team_size: 34,
    monthly_revenue_eur: 320000,
    monthly_burn_eur: 280000,
    pitch:
      "Precision machining for aerospace and defense Tier-2 suppliers. EBITDA-positive 5 years running. Two long-term contracts with Airbus subsuppliers locked through 2029.",
    website: "https://forge-mecanique.fr",
    campaigns: [
      {
        title: "5-axis CNC machines (€600k)",
        capital_seeking_eur: 600000,
        use_of_funds: "Two new 5-axis CNC machines for aerospace contracts.",
        pitch_summary:
          "Precision machining for aerospace Tier-2 suppliers. €3.8M revenue, EBITDA-positive 5 years. Backlog secured.",
        collaterals: [
          {
            type: "real_estate",
            description: "Industrial workshop — 1,800sqm, Toulouse (owned)",
            declared_value_eur: 1450000,
            document: {
              title: "Notarial deed extract - industrial property",
              lines: [
                "Notaire: Maitre Pierre Garnier, SCP Garnier-Vidal, Toulouse",
                "Acte de vente du 2009-06-22, repertoire numero 2009-1842",
                "Vendeur: SCI Aeronova (RCS Toulouse 421 558 902)",
                "Acquereur: Forge Mecanique SAS (RCS Toulouse 511 880 743)",
                "Bien: local industriel, 1,810 m2, parcelle AB 0142",
                "Adresse: 8 avenue Pierre-Georges Latecoere, 31200 Toulouse",
                "Prix d'acquisition: 980,000 EUR",
                "Estimation actuelle: 1,450,000 EUR (rapport CBRE 2026-01)",
                "Hypotheque: solde 280,000 EUR, echeance 2031, BPCE",
                "Note: bien librement detenu, aucune servitude declaree",
              ],
            },
            verdict: {
              documentRecognised: true,
              documentType: "notarial deed extract + appraisal",
              matchesClaim: "yes",
              valuePlausible: "yes",
              redFlags: [
                "Outstanding mortgage of 280,000 EUR with BPCE (matures 2031) — net equity is closer to 1.17M EUR.",
              ],
              summary:
                "Notarial deed confirms Forge Mecanique owns the 1,810sqm industrial workshop in Toulouse since 2009. CBRE 2026 appraisal supports the 1.45M EUR declared value. Outstanding 280k EUR mortgage with BPCE means net equity is around 1.17M EUR — that should be the figure investors evaluate against.",
              confidenceScore: 81,
            },
          },
          {
            type: "contract",
            description: "Multi-year supply agreement — Daher Aerospace (signed 2024, €4.2M backlog)",
            declared_value_eur: 4200000,
            document: {
              title: "Master supply agreement",
              lines: [
                "Buyer: Daher Aerospace SAS",
                "Supplier: Forge Mecanique SAS",
                "Effective: 2024-09-01",
                "Term: 5 years, expiring 2029-08-31",
                "Scope: machined titanium and aluminium parts for A320neo programme",
                "Pricing: indexed annually to LME aluminium + 3.4%",
                "Estimated 5-year volume: 4.2 million EUR",
                "Termination: 6 months notice, only for material breach",
                "Annual minimum order: 700,000 EUR (with 15% adjustment band)",
              ],
            },
            verdict: {
              documentRecognised: true,
              documentType: "multi-year supply agreement",
              matchesClaim: "partial",
              valuePlausible: "ambiguous",
              redFlags: [
                "Declared value (4.2M EUR) reflects ESTIMATED 5-year volume, not a binding commitment — only the 700k EUR annual minimum is contractually guaranteed.",
                "Pricing indexed to LME aluminium — the 3.4% margin is exposed if commodity volatility spikes.",
              ],
              summary:
                "Genuine long-term supply agreement with a Tier-1 aerospace counterparty (Daher). The 4.2M EUR figure is the ESTIMATED 5-year volume, not a firm commitment — the contractually guaranteed minimum is 700k EUR/year (3.5M EUR over remaining term, with a 15% adjustment band). Investors should underwrite against the minimum, not the estimate.",
              confidenceScore: 72,
            },
          },
        ],
      },
    ],
  },
  {
    id: "smb-helsinki-textiles",
    display_name: "Klaus Müller",
    email: "klaus@helsinki-textiles.de",
    name: "Helsinki Textiles",
    sector: "manufacturing",
    stage: "growth",
    country: "DE",
    city: "Bremen",
    founded_year: 2015,
    team_size: 19,
    monthly_revenue_eur: 165000,
    monthly_burn_eur: 140000,
    pitch:
      "Sustainable wool textile manufacturer supplying 12 European fashion brands. Closed-loop water system, 100% renewable energy.",
    website: null,
    campaigns: [
      {
        title: "In-house dyeing line (€450k)",
        capital_seeking_eur: 450000,
        use_of_funds: "Vertical integration: in-house dyeing line.",
        pitch_summary:
          "Sustainable wool textile manufacturer. 12 European fashion brand customers. Growing 18% YoY. Investing in vertical integration.",
      },
    ],
  },
  {
    id: "smb-casa-rosa",
    display_name: "Miguel Costa",
    email: "miguel@casarosa.pt",
    name: "Casa Rosa",
    sector: "retail",
    stage: "growth",
    country: "PT",
    city: "Porto",
    founded_year: 2014,
    team_size: 11,
    monthly_revenue_eur: 70000,
    monthly_burn_eur: 55000,
    pitch:
      "Boutique winery producing 90,000 bottles/year. 4 Michelin-recommended placements.",
    website: "https://casarosa.pt",
    campaigns: [
      {
        title: "DTC launch + vineyard expansion (€300k)",
        capital_seeking_eur: 300000,
        use_of_funds:
          "DTC e-commerce launch, 5 hectares additional vineyard land.",
        pitch_summary:
          "Boutique winery producing 90,000 bottles/year, sold mostly through restaurants in Porto and Lisbon. Wants to launch direct-to-consumer.",
      },
    ],
  },
  {
    id: "smb-brux-bots",
    display_name: "Ines Lambert",
    email: "ines@bruxbots.be",
    name: "Brux Bots",
    sector: "agency",
    stage: "early",
    country: "BE",
    city: "Brussels",
    founded_year: 2022,
    team_size: 6,
    monthly_revenue_eur: 28000,
    monthly_burn_eur: 30000,
    pitch:
      "RPA agency specialising in finance back-office automation for Belgian SMEs. Founder ex-Deloitte process automation lead.",
    website: "https://bruxbots.be",
    campaigns: [
      {
        title: "RPA hires + product spin-out (€175k)",
        capital_seeking_eur: 175000,
        use_of_funds: "Hire 2 RPA developers, productize one workflow into a SaaS.",
        pitch_summary:
          "RPA agency specialising in finance back-office automation. €330k revenue, 14 retainer clients. Productizing one workflow into a SaaS.",
      },
    ],
  },
  {
    id: "smb-kelvin-translate",
    display_name: "Anna Schmidt",
    email: "anna@kelvin-translate.de",
    name: "Kelvin Translate",
    sector: "saas_micro",
    stage: "growth",
    country: "DE",
    city: "Berlin",
    founded_year: 2019,
    team_size: 14,
    monthly_revenue_eur: 95000,
    monthly_burn_eur: 80000,
    pitch:
      "Localisation platform for SaaS companies with 25+ language requirements. Bootstrapped, 130+ paying customers.",
    website: "https://kelvin-translate.de",
    campaigns: [
      {
        title: "Engineering scale-up (€400k)",
        capital_seeking_eur: 400000,
        use_of_funds: "Hire 4 engineers, scale up customer success.",
        pitch_summary:
          "Localisation platform for SaaS companies with 25+ language requirements. €1.1M ARR, 91% net retention.",
      },
    ],
  },
  {
    id: "smb-bambino-shop",
    display_name: "Francesca Bianchi",
    email: "francesca@bambino.it",
    name: "Bambino Shop",
    sector: "ecommerce",
    stage: "early",
    country: "IT",
    city: "Bologna",
    founded_year: 2021,
    team_size: 7,
    monthly_revenue_eur: 55000,
    monthly_burn_eur: 50000,
    pitch:
      "Curated kids-fashion e-commerce focused on small Italian artisan brands.",
    website: "https://bambino.it",
    campaigns: [
      {
        title: "DE/FR acquisition + inventory (€120k)",
        capital_seeking_eur: 120000,
        use_of_funds: "Inventory + paid acquisition in DE and FR.",
        pitch_summary:
          "Curated kids-fashion e-commerce focused on small Italian artisan brands. 38% repeat-purchase rate. Profitable on contribution margin.",
      },
    ],
  },
  {
    id: "smb-atelier-fiscal",
    display_name: "Hugo Mercier",
    email: "hugo@atelier-fiscal.fr",
    name: "Atelier Fiscal",
    sector: "professional_services",
    stage: "growth",
    country: "FR",
    city: "Lyon",
    founded_year: 2016,
    team_size: 16,
    monthly_revenue_eur: 130000,
    monthly_burn_eur: 110000,
    pitch:
      "Tech-forward accounting firm serving 240 SMB clients. Plans to launch a paid SaaS for self-serve clients.",
    website: "https://atelier-fiscal.fr",
    campaigns: [
      {
        title: "Internal automation tool (€200k)",
        capital_seeking_eur: 200000,
        use_of_funds: "Build internal automation tool to scale partner leverage.",
        pitch_summary:
          "Tech-forward accounting firm serving 240 SMB clients. €1.5M revenue, 20% net. Growing 15% YoY.",
      },
    ],
  },
  {
    id: "smb-clay-stories",
    display_name: "Sanne De Vries",
    email: "sanne@claystories.nl",
    name: "Clay Stories",
    sector: "makers",
    stage: "pre_revenue",
    country: "NL",
    city: "Amsterdam",
    founded_year: 2024,
    team_size: 3,
    monthly_revenue_eur: null,
    monthly_burn_eur: 18000,
    pitch:
      "Pottery studio launching a homewares brand. Founder previously at &Other Stories home design.",
    website: null,
    campaigns: [
      {
        title: "First production run (€80k)",
        capital_seeking_eur: 80000,
        use_of_funds: "First production run, e-commerce setup, 6-month runway.",
        pitch_summary:
          "Pottery studio launching a homewares brand. 6-piece collection of hand-thrown stoneware. Pre-orders waiting list of 240.",
      },
    ],
  },
  {
    id: "smb-dev-circle",
    display_name: "Tobias Krause",
    email: "tobias@devcircle.de",
    name: "Dev Circle",
    sector: "agency",
    stage: "growth",
    country: "DE",
    city: "Munich",
    founded_year: 2014,
    team_size: 28,
    monthly_revenue_eur: 290000,
    monthly_burn_eur: 250000,
    pitch:
      "Software dev agency for German Mittelstand digitisation projects. Steady project pipeline.",
    website: "https://devcircle.de",
    campaigns: [
      {
        title: "Berlin office + senior hires (€350k)",
        capital_seeking_eur: 350000,
        use_of_funds: "Open Berlin office, hire 6 senior engineers.",
        pitch_summary:
          "Software dev agency for German Mittelstand. €3.4M revenue, EBITDA +12%. 3 long-term contracts plus a steady pipeline.",
      },
    ],
  },
  {
    id: "smb-ole-foods",
    display_name: "Lucia Garcia",
    email: "lucia@olefoods.es",
    name: "Olé Foods",
    sector: "ecommerce",
    stage: "early",
    country: "ES",
    city: "Valencia",
    founded_year: 2022,
    team_size: 9,
    monthly_revenue_eur: 88000,
    monthly_burn_eur: 78000,
    pitch:
      "DTC tapas + small-plate brand selling premium Iberian SKUs across EU.",
    website: "https://olefoods.es",
    campaigns: [
      {
        title: "Cold-chain + EU expansion (€220k)",
        capital_seeking_eur: 220000,
        use_of_funds: "Cold-chain logistics + acquisition in DE and NL.",
        pitch_summary:
          "DTC tapas + small-plate brand selling premium Iberian SKUs across EU. €1M ARR, 32% gross margin, 41% repeat-purchase rate.",
      },
    ],
  },
  {
    id: "smb-milano-loop",
    display_name: "Davide Conti",
    email: "davide@milanoloop.it",
    name: "Milano Loop",
    sector: "makers",
    stage: "early",
    country: "IT",
    city: "Milano",
    founded_year: 2020,
    team_size: 8,
    monthly_revenue_eur: 36000,
    monthly_burn_eur: 32000,
    pitch:
      "Leather workshop producing made-to-order bags and small accessories. Margin 41%.",
    website: "https://milanoloop.it",
    campaigns: [
      {
        title: "Florence workshop + artisan hires (€170k)",
        capital_seeking_eur: 170000,
        use_of_funds: "Open second workshop in Florence, hire 3 leather artisans.",
        pitch_summary:
          "Leather workshop producing made-to-order bags and accessories. €430k revenue, all DTC. 4-week production lead time.",
      },
    ],
  },
  {
    id: "smb-brain-train",
    display_name: "Alice Verhaegen",
    email: "alice@braintrain.be",
    name: "Brain Train",
    sector: "saas_micro",
    stage: "early",
    country: "BE",
    city: "Antwerp",
    founded_year: 2021,
    team_size: 7,
    monthly_revenue_eur: 31000,
    monthly_burn_eur: 38000,
    pitch:
      "Adaptive learning platform for corporate training. Team has 2 ex-Acapela ML engineers.",
    website: "https://braintrain.be",
    campaigns: [
      {
        title: "Sales hire + 12-month runway (€280k)",
        capital_seeking_eur: 280000,
        use_of_funds: "Sales hire + 12 months runway.",
        pitch_summary:
          "Adaptive learning platform for corporate training. €370k ARR, 22 enterprise customers.",
      },
    ],
  },
  {
    id: "smb-green-grid",
    display_name: "Hans Schmidt",
    email: "hans@greengrid.de",
    name: "Green Grid",
    sector: "b2b_services",
    stage: "growth",
    country: "DE",
    city: "Hamburg",
    founded_year: 2013,
    team_size: 41,
    monthly_revenue_eur: 480000,
    monthly_burn_eur: 410000,
    pitch:
      "B2B installer of EV charging infrastructure for logistics companies. Backlog of 9 months.",
    website: "https://greengrid.de",
    campaigns: [
      {
        title: "Regional service hubs (€750k)",
        capital_seeking_eur: 750000,
        use_of_funds: "Two regional service hubs in NRW and Bavaria.",
        pitch_summary:
          "B2B installer of EV charging infrastructure. €5.7M revenue, EBITDA +14%. Heavy demand from DHL/Hermes contractors.",
      },
    ],
  },
  {
    id: "smb-petit-paquet",
    display_name: "Camille Roux",
    email: "camille@petitpaquet.fr",
    name: "Petit Paquet",
    sector: "b2b_services",
    stage: "early",
    country: "FR",
    city: "Bordeaux",
    founded_year: 2022,
    team_size: 11,
    monthly_revenue_eur: 110000,
    monthly_burn_eur: 130000,
    pitch:
      "Last-mile B2B parcel logistics for the southwest of France. Underwriting margins improved to break-even at unit level.",
    website: "https://petitpaquet.fr",
    campaigns: [
      {
        title: "Fleet + dispatch software (€320k)",
        capital_seeking_eur: 320000,
        use_of_funds: "Fleet expansion + dispatch software.",
        pitch_summary:
          "Last-mile B2B parcel logistics for the southwest of France. €1.3M run-rate revenue.",
        collaterals: [
          {
            type: "inventory",
            description: "Delivery van fleet (12 vehicles, owned)",
            declared_value_eur: 240000,
            document: {
              title: "Vehicle inventory listing",
              lines: [
                "Petit Paquet SAS - fleet roster",
                "Date: 2026-03-12",
                "Total declared: 12 Renault Kangoo Z.E. delivery vans",
                "Confirmed in carte-grise scans:",
                "  - 4 vans, 2019, 110-130k km each",
                "  - 3 vans, 2020, 80-95k km each",
                "Note: 5 vehicles listed in claim but no carte-grise present in this packet",
                "Aggregate market value (Argus, vans present only): ~88,000 EUR",
              ],
            },
            verdict: {
              documentRecognised: true,
              documentType: "internal vehicle inventory",
              matchesClaim: "partial",
              valuePlausible: "no",
              redFlags: [
                "Founder claims 12 vans but only 7 carte-grise documents are attached — 5 vehicles are unsubstantiated.",
                "Argus market value of the documented 7 vans is ~88,000 EUR vs. declared collateral value of 240,000 EUR — even pro-rated to 12, the implied value is ~150,000 EUR, not 240,000.",
                "All Kangoo Z.E. units are 5-7 years old with 80-130k km — they're closer to end-of-life than the declared value suggests.",
              ],
              summary:
                "Document only substantiates 7 of the 12 claimed vans. Even taking the 7 at face value, market value is ~88k EUR (Argus); the 240k EUR declared total is roughly 2.7x the substantiated worth. The 5 missing carte-grise documents need to be produced before this can stand as collateral.",
              confidenceScore: 58,
            },
          },
        ],
      },
    ],
  },
  {
    id: "smb-lisbonne-data",
    display_name: "Patricia Lopes",
    email: "patricia@lisbonne-data.pt",
    name: "Lisbonne Data",
    sector: "professional_services",
    stage: "pre_revenue",
    country: "PT",
    city: "Lisbon",
    founded_year: 2024,
    team_size: 4,
    monthly_revenue_eur: null,
    monthly_burn_eur: 24000,
    pitch:
      "Boutique data-engineering consultancy spun out of a top-3 European bank's data platform team.",
    website: null,
    campaigns: [
      {
        title: "GTM + 12-month runway (€100k)",
        capital_seeking_eur: 100000,
        use_of_funds: "First 12 months of runway + go-to-market.",
        pitch_summary:
          "Boutique data-engineering consultancy spun out of a top-3 European bank's data platform team. 3 LOIs from prior employer.",
      },
    ],
  },
];

console.log(`Seeding ${COMPANIES.length} companies + initial campaigns…`);
for (const c of COMPANIES) {
  const userId = `seed-user-${c.id}`;
  upsertUser({
    id: userId,
    email: c.email,
    type: "smb",
    displayName: c.display_name,
  });
  createCompany({
    id: c.id,
    user_id: userId,
    name: c.name,
    sector: c.sector,
    stage: c.stage,
    country: c.country,
    city: c.city,
    founded_year: c.founded_year,
    team_size: c.team_size,
    monthly_revenue_eur: c.monthly_revenue_eur,
    monthly_burn_eur: c.monthly_burn_eur,
    pitch: c.pitch,
    website: c.website,
  });
  for (const camp of c.campaigns) {
    const created = createCampaign({
      id: camp.id,
      company_id: c.id,
      title: camp.title,
      capital_seeking_eur: camp.capital_seeking_eur,
      use_of_funds: camp.use_of_funds,
      pitch_summary: camp.pitch_summary,
      status: "open",
    });
    for (const col of camp.collaterals ?? []) {
      const collateralId = randomUUID();
      const filename = `${collateralId}.pdf`;
      writePdf(UPLOAD_DIR, filename, col.document);
      const now = Date.now();
      db.prepare(
        `INSERT INTO collaterals (
           id, campaign_id, type, description, declared_value_eur,
           document_filename, document_url,
           ai_score, ai_verdict_json, ai_checked_at,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        collateralId,
        created.id,
        col.type,
        col.description,
        col.declared_value_eur,
        col.document.title.replace(/\s+/g, "-").toLowerCase().slice(0, 80) + ".pdf",
        `/api/uploads/${filename}`,
        col.verdict.confidenceScore,
        JSON.stringify(col.verdict),
        now,
        now
      );
    }
  }
}

type InvestorSeed = {
  id: string;
  email: string;
  display_name: string;
  thesis_text: string;
  sectors: string[];
  countries: string[];
  stages: ("pre_revenue" | "early" | "growth")[];
  ticket_min_eur: number;
  ticket_max_eur: number;
  total_capital_eur: number;
  risk_tolerance: "low" | "medium" | "high";
};

const INVESTORS: InvestorSeed[] = [
  {
    id: "inv-marais",
    email: "principal@marais-capital.fr",
    display_name: "Marais Capital",
    thesis_text:
      "Pre-seed and seed checks into French and Benelux B2B SaaS and digital agencies. Look for €15-50k MRR, founder-market fit, capital efficient.",
    sectors: ["saas_micro", "agency", "professional_services"],
    countries: ["FR", "BE"],
    stages: ["early", "growth"],
    ticket_min_eur: 100000,
    ticket_max_eur: 500000,
    total_capital_eur: 8000000,
    risk_tolerance: "medium",
  },
  {
    id: "inv-northern-light",
    email: "office@northern-light.de",
    display_name: "Northern Light Family Office",
    thesis_text:
      "Family office with 30-year industrial heritage. Backs DACH and Benelux makers and manufacturers with proven unit economics.",
    sectors: ["manufacturing", "makers"],
    countries: ["DE", "NL", "BE"],
    stages: ["growth"],
    ticket_min_eur: 200000,
    ticket_max_eur: 1000000,
    total_capital_eur: 25000000,
    risk_tolerance: "low",
  },
  {
    id: "inv-casa-azul",
    email: "team@casa-azul.com",
    display_name: "Casa Azul Ventures",
    thesis_text:
      "Iberian-focused fund for D2C consumer and retail brands with strong margin profiles and bilingual founders.",
    sectors: ["ecommerce", "retail"],
    countries: ["ES", "IT", "PT"],
    stages: ["early", "growth"],
    ticket_min_eur: 50000,
    ticket_max_eur: 250000,
    total_capital_eur: 5000000,
    risk_tolerance: "medium",
  },
  {
    id: "inv-hexa",
    email: "syndicate@hexa-angels.com",
    display_name: "Hexa Angels",
    thesis_text:
      "French angel syndicate writing first-cheque tickets across all sectors. Looking for solo founders or 2-person teams with clear EU ambition.",
    sectors: [
      "saas_micro",
      "agency",
      "ecommerce",
      "makers",
      "professional_services",
      "b2b_services",
    ],
    countries: ["FR"],
    stages: ["pre_revenue", "early"],
    ticket_min_eur: 25000,
    ticket_max_eur: 100000,
    total_capital_eur: 2000000,
    risk_tolerance: "high",
  },
  {
    id: "inv-continental",
    email: "ic@continental-compounder.eu",
    display_name: "Continental Compounder",
    thesis_text:
      "Pan-European search-fund-style operator. Targets profitable growth-stage SMBs across all sectors with proven cash flow and a path to consolidation.",
    sectors: [
      "manufacturing",
      "b2b_services",
      "professional_services",
      "saas_micro",
      "agency",
    ],
    countries: ["FR", "DE", "ES", "IT", "NL", "BE", "PT"],
    stages: ["growth"],
    ticket_min_eur: 500000,
    ticket_max_eur: 2000000,
    total_capital_eur: 50000000,
    risk_tolerance: "low",
  },
];

console.log(`Seeding ${INVESTORS.length} investors…`);
for (const inv of INVESTORS) {
  const userId = `seed-user-${inv.id}`;
  upsertUser({
    id: userId,
    email: inv.email,
    type: "investor",
    displayName: inv.display_name,
  });
  createInvestor({
    id: inv.id,
    user_id: userId,
    display_name: inv.display_name,
    thesis_text: inv.thesis_text,
    sectors_json: JSON.stringify(inv.sectors),
    countries_json: JSON.stringify(inv.countries),
    stages_json: JSON.stringify(inv.stages),
    ticket_min_eur: inv.ticket_min_eur,
    ticket_max_eur: inv.ticket_max_eur,
    total_capital_eur: inv.total_capital_eur,
    risk_tolerance: inv.risk_tolerance,
  });
}

// Seed two ratings per hero so the trust layer is visible at demo time.
const HERO_RATING_TARGETS = ["hero-atelier-paris", "hero-meridian-saas"];
console.log("Seeding ratings on hero companies…");
for (const cid of HERO_RATING_TARGETS) {
  const target = db
    .prepare("SELECT user_id FROM companies WHERE id = ?")
    .get(cid) as { user_id: string } | undefined;
  if (!target) continue;
  const raterUserId1 = `seed-user-inv-marais`;
  const raterUserId2 = `seed-user-inv-continental`;
  db.prepare(
    "INSERT INTO ratings (rater_user_id, rated_user_id, rated_type, score, dimensions_json, comment, created_at) VALUES (?, ?, 'smb', ?, ?, ?, ?)"
  ).run(
    raterUserId1,
    target.user_id,
    5,
    JSON.stringify({ responsiveness: 5, info_quality: 5 }),
    "Founder was prompt with the data room and answered hard questions directly.",
    Date.now()
  );
  db.prepare(
    "INSERT INTO ratings (rater_user_id, rated_user_id, rated_type, score, dimensions_json, comment, created_at) VALUES (?, ?, 'smb', ?, ?, ?, ?)"
  ).run(
    raterUserId2,
    target.user_id,
    4,
    JSON.stringify({ responsiveness: 4, info_quality: 5 }),
    "Solid numbers, slightly optimistic on growth assumptions but transparent about it.",
    Date.now()
  );
  // Refresh aggregate
  db.prepare(
    `UPDATE companies SET
       rating_avg = (SELECT AVG(score) FROM ratings WHERE rated_user_id = companies.user_id AND rated_type = 'smb'),
       rating_count = (SELECT COUNT(*) FROM ratings WHERE rated_user_id = companies.user_id AND rated_type = 'smb')
     WHERE id = ?`
  ).run(cid);
}

const counts = {
  users: (db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number })
    .n,
  companies: (
    db.prepare("SELECT COUNT(*) as n FROM companies").get() as { n: number }
  ).n,
  campaigns: (
    db.prepare("SELECT COUNT(*) as n FROM campaigns").get() as { n: number }
  ).n,
  investors: (
    db.prepare("SELECT COUNT(*) as n FROM investors").get() as { n: number }
  ).n,
  ratings: (
    db.prepare("SELECT COUNT(*) as n FROM ratings").get() as { n: number }
  ).n,
};
console.log("Seed complete:", counts);
