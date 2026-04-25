# Loanly — SMB ↔ Investor Marketplace × AI

> **Capital, finally routed to Europe's real economy.**
> An AI-native marketplace that matches non-tech European SMBs raising capital with thesis-driven angels, family offices, and search funds — with due diligence, matching, and collateral verification built in.

Built at the **Paris Fintech Hackathon 2026** in 24h. Mistral Large 2 + Vercel AI SDK + Tavily + Clerk + SQLite.

---

## Why this exists

AngelList serves US tech startups doing venture rounds — **the 1%**. The other 25M EU SMBs (agencies, B2B services, makers, manufacturers) have nowhere to go.

**Three structural differentiators**:
1. **Audience AngelList won't pivot to** — non-tech European SMBs, €50k–500k tickets, regional angels and family offices.
2. **Fractionalisation for big-ticket capital** — family offices can't deploy €2M across 30 SMBs without 50 hours of work. Our AI does it in seconds.
3. **AI as structural product** — without LLMs, the four core features collapse. AI doesn't decorate the product; it *is* the product.

## The four AI features

| # | Feature | Wow |
|---|---|---|
| 1 | **Conversational SMB onboarding** | Replace a 50-field form with a 5-turn chat. Right pane materialises a structured listing in real time. |
| 2 | **AI-DD analyst** *(killer)* | Investor opens a deal → tool-calling agent (web search + page fetch + SIRENE registry) produces a one-page brief with risk flags and cited sources. Live agent trace streamed to the UI. |
| 3 | **AI portfolio constructor** | Investor enters constraints → SQL hard-filter → rule-based fit-score → Mistral re-ranks + allocates → 8–15 picks with rationale + sector donut, in <20s. |
| 4 | **Curated matching feed** | Investor's thesis → top-10 ranked deals streamed in with one-line reasoning per pick. Cached 1h per investor. |

Plus, beyond the original spec:
- **Multi-company / multi-campaign architecture** — one founder can own multiple companies, each with multiple fundraising campaigns.
- **Collateral upload + AI proof check** — upload a PDF, the AI extracts text, verifies the claim, scores plausibility 0–100, and flags red flags for investors.
- **Natural-language + voice filters** — describe what you want (or say it via the mic, Web Speech API), Mistral parses to structured filters.
- **Bidirectional ratings** — Airbnb-style trust layer with dimensions (responsiveness, info quality).

---

## Tech stack (locked)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui |
| Backend | Next.js API routes (Node runtime) |
| DB | SQLite via `better-sqlite3` |
| Auth | Clerk |
| AI | **Mistral Large 2** via Vercel AI SDK v6 — `@ai-sdk/mistral` |
| AI fallback | **Cerebras Llama 3.3 70B** — auto-fallback if Mistral fails |
| Web search | Tavily — `@tavily/core` |
| FR registry | SIRENE V3.11 (INSEE) |
| PDF parsing | `pdf-parse` v2 |
| Charts | Recharts |
| Schema validation | Zod |
| Hosting | Vercel |

---

## Setup

### Prerequisites
- Node.js 20+
- pnpm 10+ (`brew install pnpm`)
- A Clerk account (dev tier is free)
- A Mistral API key
- A Tavily API key (free tier: 1000 searches/month)
- *(optional)* Cerebras API key (fallback)
- *(optional)* SIRENE integration key from [portail-api.insee.fr](https://portail-api.insee.fr/) — needed for FR company lookups in DD briefs

### Install
```bash
pnpm install
cp .env.example .env.local
# fill in CLERK, MISTRAL, TAVILY, optionally CEREBRAS and SIRENE
```

### Initialise the DB and seed
```bash
pnpm db:bootstrap   # creates ./data/hack.db with schema
pnpm db:seed        # 20 companies + 20 campaigns + 5 investors + hero ratings
```

### Pre-cache hero DD briefs (optional but recommended for live demo)
```bash
pnpm exec tsx --env-file=.env.local scripts/precache-dd.ts
```

### Run dev server
```bash
pnpm dev
# → http://localhost:3000
```

### Production build
```bash
pnpm build && pnpm start
```

### Common scripts
| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server with hot reload |
| `pnpm build` | Production build |
| `pnpm db:bootstrap` | Create DB schema (idempotent) |
| `pnpm db:seed` | Wipe seed rows and re-seed |
| `pnpm db:reset` | Delete DB file and re-bootstrap |
| `pnpm exec tsc --noEmit` | Type check |

---

## Architecture

```
┌────────────────────────────┐         ┌──────────────────────────────┐
│  Investor / SMB browsers   │ Clerk   │  Next.js 15 (App Router)     │
│                            │ ──────▶ │  • Server components (DB)    │
│                            │         │  • Streaming API routes      │
└────────────────────────────┘         │  • Middleware (role-aware)   │
                                       └──────┬───────────┬───────────┘
                                              │           │
                                              ▼           ▼
                                  ┌───────────────┐  ┌─────────────────┐
                                  │ SQLite        │  │  Mistral Large  │
                                  │ (8 tables)    │  │  (+ Cerebras    │
                                  │               │  │     fallback)   │
                                  └───────────────┘  └────┬────────────┘
                                                          │
                                          ┌───────────────┼─────────────────┐
                                          ▼               ▼                 ▼
                                     Tavily          fetchUrl         SIRENE V3
                                  (web search)      (HTTP+50KB)     (FR registry)
```

### Routing groups
- `app/(smb)/*` — SMB-only (dashboard, onboard)
- `app/(investor)/*` — investor-only (feed, matches, portfolio, thesis)
- `app/company/[id]`, `app/campaign/[id]` — auth-only, both roles
- `app/api/*` — auth-gated by middleware

### Data model (8 tables)
- **users** — Clerk-linked, role + display name
- **companies** — name, sector, country, traction, pitch, website (1 per founder, can have many)
- **campaigns** — title, capital_seeking, use_of_funds, status open/closed/funded (N per company)
- **collaterals** — type, declared_value, document_url, ai_score, ai_verdict_json (N per campaign)
- **investors** — thesis (free text + structured: sectors, countries, stages, ticket range, risk)
- **dd_briefs** — cached per company
- **portfolio_proposals**, **match_caches** — cached AI outputs
- **ratings** — bidirectional 1–5 stars + dimensions JSON
- **conversations** — onboarding transcripts saved for replay

---

## API surface

| Method + Path | Purpose | Auth |
|---|---|---|
| `POST /api/smb/onboard` | Streaming onboarding chat | SMB |
| `POST /api/smb/extract` | Mid-chat partial extraction | SMB |
| `POST /api/smb/finalize` | Write company + first campaign from transcript | SMB |
| `POST /api/company/[id]/campaigns` | Add another campaign to a company | SMB owner |
| `GET /api/company/[id]/dd` | Cached or fresh DD brief | Investor |
| `GET /api/company/[id]/dd/stream` | Live agent trace + brief | Investor |
| `POST /api/campaign/[id]/collateral` | Upload + AI verify collateral | SMB owner |
| `GET /api/uploads/[name]` | Auth-gated file serving | Either |
| `POST /api/investor/thesis` | Save investor thesis | Investor |
| `POST /api/investor/portfolio` | Run portfolio constructor | Investor |
| `GET /api/match` / `/api/match/stream` | Curated feed + live ranking | Investor |
| `POST /api/parse-query` | NL → structured filters | Either |
| `POST /api/rate` | Submit rating | Either |

---

## 🎯 The 3-minute demo path

Every product decision serves this. Time on stage: ~3 minutes.

### 1. Sign in as **investor** → set the thesis (20s)
- Hit `/thesis`. The default tab is "Describe in plain English".
- **Click the 🎤 mic and say:**

  > *"I want profitable European B2B SaaS and agencies in France and Benelux. Tickets €100k to €500k, 3-year hold, low risk."*

- Or paste:

  ```
  I want profitable European B2B SaaS and agencies in France and Benelux. Tickets 100k to 500k euros, 3-year hold, low risk.
  ```

- Click **Save thesis**. The "AI applied:" chip shows the parsed sectors, countries, and risk.

### 2. Land on the **curated feed** (5s)
- Navigate to `/matches`. The streaming UI shows live stages: *"Reading thesis → Filtering campaigns → Mistral is ranking deals."*
- Top 10 cards stream in with **fit score badge** and one-line **AI reasoning** per pick.

### 3. Click a hero deal → **DD brief** (3s — *Wow #1*)
- Click **Atelier Paris Coffee Roasters → Lyon roastery + B2B sales team (€350k)**.
- Brief loads instantly (cached). Sentiment gauge, overview, traction, team, market context, **colour-coded risk flags**, and **clickable sources**.
- *"This is a 5-hour analyst pass in 3 seconds."*
- For non-cached SMBs: click "Run DD agent" — watch the live trace (web search → page fetch → SIRENE registry → structuring), brief lands in ~30s.

### 4. Build a **portfolio** (5s — *Wow #2*)
- Navigate to `/portfolio`. Default tab: natural language.
- **Mic or paste:**

  ```
  Two million euros across French B2B SaaS and agencies. Low risk, profitable companies, max 10 positions, 3-year hold.
  ```

- Click **Build portfolio**. ~6s later: 5–10 positions, allocations summing to €2M, sector donut, per-pick rationale.
- *"Big-ticket capital, fractionalised."*

### 5. Sign out → sign in as **SMB founder** → onboard (45s — *Wow #3*)
- `/onboard`. Chat 5 turns:
  1. *"Bicicletas do Tejo, a small Lisbon bike rental and guided tour company. We rent e-bikes by the hour and run riverside tours along the Tagus."*
  2. *"Founded in 2019. Six full-time staff plus a few seasonal guides."*
  3. *"About 35 000 EUR monthly revenue in summer, 12 000 in winter. Burn around 15 000 a month."*
  4. *"Raising 180 000 EUR — add 30 e-bikes, open a second pickup point in Belém, and hire two more guides."*
  5. *"Yes, our site is bicicletasdotejo.pt"*
- Watch the right pane fill — name → sector → country → traction → pitch summary materialising live.
- Click **Finalize** → land on `/dashboard` with the new company + initial campaign.

### 6. Show the trust + collateral layers (15s)
- Open a hero campaign → scroll to **ratings** (2 seeded reviews per hero with comments).
- Show the **Add collateral** form on `/campaign/[id]/manage` — upload any PDF, the AI extracts text, verifies the claim, returns a 0–100 score + structured verdict (matchesClaim, valuePlausible, redFlags).

**Total: ~3 minutes. Six wow beats. AI on every step.**

---

## Reliability posture

- **Temperature 0** for all structured-output calls. Higher only for the conversational onboarding chat.
- **Zod-validates every LLM JSON output** with one retry on schema failure.
- **Cerebras Llama 3.3 70B fallback** on Mistral failure (rate limit, network, timeout) — wired across all demo-critical calls (`lib/ai/client.ts:withModelFallback`).
- **AI SDK retries** bumped to `maxRetries: 3-4` on streaming + structured calls.
- **Cached results in DB** for DD briefs, portfolio proposals, match results — demo never depends on a live LLM call.
- **Hero DD briefs pre-generated** before the demo (`scripts/precache-dd.ts`).

---

## Out of MVP — explicitly deferred

- Real escrow / capital flow
- Smart contracts / on-chain anything
- Email notifications, weekly digest sends
- Real-time chat between investor + SMB
- Investor verification / accreditation checks
- Mobile responsive past basic

---

## Devpost — submission copy

**Title**
> Loanly — AI-native marketplace for European SMBs and thesis-driven investors

**Tagline (≤ 200 chars)**
> Mistral-powered marketplace that matches non-tech European SMBs raising capital with the right investors. AI does the sourcing, the DD, the portfolio construction, and the collateral verification.

**Tech tags**
`Mistral AI` · `Vercel AI SDK` · `Next.js 15` · `Tailwind` · `shadcn/ui` · `Clerk` · `SQLite` · `Tavily` · `SIRENE / INSEE` · `Cerebras` · `Zod` · `TypeScript`

**Inspiration**
> 25 million European SMBs are economic engines invisible to AngelList — agencies, makers, manufacturers, B2B services. They raise €50k–500k tickets from regional angels and family offices, who themselves can't deploy at scale without 50 hours of analyst work per deal. AI changes that economics.

**What it does**
> Loanly is a two-sided marketplace where founders onboard via a conversation (no 50-field form), each deal ships with an AI-generated DD brief sourced from web + registry + the company's own site, big-ticket investors get fractionalised portfolios across 10–20 SMBs in seconds, and collateral uploaded as PDFs is automatically verified. AI is on every screen.

**How we built it**
> Next.js 15 App Router, Vercel AI SDK v6 with Mistral Large 2 (and Cerebras Llama 3.3 70B as automatic fallback), tool-calling agent for DD with Tavily web search and SIRENE registry lookup, Zod-validated structured outputs for every LLM call, SQLite for everything (companies + campaigns + collaterals + dd_briefs + ratings), Clerk for auth, shadcn/ui for the polish.

**Challenges**
> Schema-design migration mid-build to support multi-company + multi-campaign + collaterals; live-streaming the DD agent's tool calls and the matching ranker's intermediate output; Cerebras fallback to keep the demo bulletproof under rate limits.

**Accomplishments**
> All four AI features built end-to-end in 24h, plus an entire collateral verification subsystem (PDF parse → Mistral verdict). Every wow moment in the demo path is < 5 seconds, including the freshly-streamed DD agent that visibly searches, fetches, and registry-checks before structuring its findings.

**What's next**
> Real-time investor↔SMB messaging, escrow integration, multi-country company registry coverage (Companies House UK, Handelsregister DE, RC Spain), audit trail for AI-assisted decisions, weekly thesis-aware digest emails.

**Repo**
> https://github.com/<your-org>/paris-fintech-hackathon

---

## Repo structure

```
hack-mvp/
├── app/
│   ├── layout.tsx                       # Clerk provider, Tailwind v4
│   ├── page.tsx                         # Landing (Loanly brand)
│   ├── (smb)/                           # SMB-only routing group
│   │   ├── dashboard/page.tsx           # Owned companies + campaigns
│   │   └── onboard/                     # Conversational onboarding
│   ├── (investor)/                      # Investor-only routing group
│   │   ├── feed/                        # Browse all open campaigns
│   │   ├── matches/                     # Curated top-10 (streamed)
│   │   ├── portfolio/                   # Constructor + sector donut
│   │   └── thesis/                      # NL or manual thesis form
│   ├── company/[id]/                    # Company profile + campaigns
│   │   └── new-campaign/                # Add another campaign
│   ├── campaign/[id]/                   # Deal detail (DD + collateral + rate)
│   │   └── manage/                      # Owner-only collateral upload
│   ├── select-role/                     # SMB or Investor picker
│   └── api/                             # Streaming + non-streaming routes
├── lib/
│   ├── db.ts                            # better-sqlite3 + helpers
│   ├── auth.ts                          # Clerk + role gating
│   ├── format.ts                        # EUR + flag formatters
│   ├── ai/                              # client, dd-analyst, match,
│   │                                    #   portfolio, parse-query,
│   │                                    #   onboarding-smb, collateral-verify
│   └── tools/                           # web-search, fetch-url, company-lookup, extract-pdf
├── components/
│   ├── ui/                              # Badge, Button, Card, SectorIcon
│   ├── DDBrief.tsx, DDSection.tsx       # Live agent trace + brief view
│   ├── PortfolioView.tsx                # Table + donut
│   ├── FilterChips.tsx, FilterModeTabs.tsx, NaturalLanguageInput.tsx
│   ├── FeedFilters.tsx, RatingWidget.tsx, TopNav.tsx
├── scripts/
│   ├── db-bootstrap.ts, db-seed.ts
│   └── precache-dd.ts                   # Hero brief pre-generation
└── data/                                # SQLite + uploaded collaterals (gitignored)
```

---

## Acknowledgements

Built on the shoulders of: **Mistral AI** (model + sponsor), **Vercel AI SDK**, **Next.js**, **Clerk**, **Tavily**, **INSEE / SIRENE**, **Cerebras**, **shadcn/ui**, **Recharts**, **better-sqlite3**.
