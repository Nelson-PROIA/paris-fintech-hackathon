# Loanly

**AI-native marketplace for European SMBs and thesis-driven investors.**

> Capital, finally routed to Europe's real economy.

Built at the **Paris Fintech Hackathon 2026** in 24 hours. Mistral Large 2 + Cerebras fallback, Vercel AI SDK, Tavily, SIRENE, Clerk, SQLite.

Live demo and submission: see the [Devpost section](#devpost-submission-copy) below.

---

## Why this exists

AngelList serves US tech startups doing venture rounds — **the 1%**. The other 25 million European SMBs (agencies, B2B services, makers, manufacturers) raise €50k–500k tickets from regional angels, family offices and search funds, and they have nowhere to go.

Three structural bets:

1. **Audience AngelList won't pivot to** — non-tech European SMBs at the long tail of capital.
2. **Fractionalisation for big-ticket capital** — a family office can't deploy €2M across 30 SMBs without 50 hours of analyst work. Our AI does it in seconds.
3. **AI as the product, not decoration** — without LLMs, the four core features collapse.

---

## What's in the box

| # | Feature | What it does |
|---|---|---|
| 1 | **Conversational SMB onboarding** | Replaces a 50-field form with a 5-turn chat. The AI structures everything live (right pane materialises while you type or talk). |
| 2 | **AI due-diligence agent** | Investor opens a deal → tool-calling agent (Tavily web search · page fetch · SIRENE registry) produces an analyst-style brief with risk flags and **real cited URLs**. Tool trace streams to the UI as it runs. |
| 3 | **AI portfolio constructor** | Investor describes capital + risk + sectors → SQL hard-filter → rule-based fit-score → Mistral re-ranks and allocates. Sector donut, per-pick rationale, in <20s. |
| 4 | **Live thesis matching** | Investor's thesis → top-N ranked deals streamed in with one-line reasoning per pick. Cached per investor, refreshed on every thesis edit. |

Plus, beyond the original spec:

- **Multi-company / multi-campaign** — one founder owns N companies, each with N campaigns.
- **Collateral upload + AI proof check** — upload a PDF, the AI extracts text, verifies the founder's claim, scores plausibility 0–100, and surfaces concrete red flags. Six fixtures with pre-baked verdicts ship in the seed (real PDFs in `data/uploads/`).
- **Natural-language + voice filters** — type or hit the mic (Web Speech API), the parser turns it into structured filters.
- **Bidirectional ratings** — Airbnb-style trust layer with named dimensions (responsiveness, info quality).

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Recharts |
| Backend | Next.js API routes (Node runtime) |
| DB | SQLite via `better-sqlite3` |
| Auth | Clerk |
| AI | **Mistral Large 2** via Vercel AI SDK v6 (`@ai-sdk/mistral`) |
| AI fallback | **Cerebras Llama 3.3 70B** — automatic on Mistral failure |
| Web search | Tavily (`@tavily/core`) |
| FR registry | SIRENE V3.11 (INSEE) |
| PDF parsing | `pdf-parse` v2 |
| Schema validation | Zod |

---

## Quick start

```bash
# 1. install
pnpm install

# 2. env
cp .env.example .env.local
# fill in: CLERK keys, MISTRAL_API_KEY, TAVILY_API_KEY
# optional: CEREBRAS_API_KEY, SIRENE_API_TOKEN

# 3. db + seed (20 companies, 20 campaigns, 5 investors,
#    6 collaterals with real PDFs and pre-cached AI verdicts)
pnpm db:reset
pnpm db:seed

# 4. (optional) pre-cache hero DD briefs so they load instantly
pnpm exec tsx --env-file=.env.local scripts/precache-dd.ts

# 5. dev server
pnpm dev   # → http://localhost:3000
```

### Required env (`.env.local`)

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
MISTRAL_API_KEY=...
TAVILY_API_KEY=tvly-...

# optional but recommended
CEREBRAS_API_KEY=csk-...
SIRENE_API_TOKEN=...   # https://portail-api.insee.fr/
```

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server with hot reload |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm db:bootstrap` | Create the SQLite schema (idempotent) |
| `pnpm db:reset` | Wipe `data/hack.db` and re-bootstrap |
| `pnpm db:seed` | Wipe seed rows, re-seed companies + campaigns + collaterals (with real PDFs) |
| `pnpm exec tsc --noEmit` | Type-check the whole project |

---

## The 3-minute demo

Every product decision is in service of these three minutes.

### 1. As an **investor** — set the thesis (15s)
- Land on `/matches`. The thesis editor is at the top — chat-bar style.
- Click the mic, say:
  > *"I want profitable European B2B SaaS and agencies in France and Benelux. Tickets 100k to 500k euros, low risk."*
- Hit submit. The "AI applied" chip shows the parsed structure.

### 2. **Matches stream in** (5s)
- The same screen now ranks 200+ live campaigns and streams the top 10 in with a fit-score badge and one-line reasoning per pick.

### 3. **DD agent on a hero deal** (3s — Wow #1)
- Click `Atelier Paris Coffee Roasters → Lyon roastery + B2B sales team`.
- The brief loads instantly (cached). Sentiment ring, overview, traction, team, risk flags, and **real cited URLs** (LinkedIn profiles, the company website, an `annuaire-entreprises.data.gouv.fr` registry link, Tavily news hits).
- Run it on a non-cached SMB to watch the live tool trace: `webSearch → fetchUrl → companyLookup → structure`.

### 4. **Build a portfolio** (6s — Wow #2)
- `/portfolio`. Mic or paste:
  > *"Two million euros across French B2B SaaS and agencies. Low risk, 12 positions."*
- 6 seconds later: holdings table with allocations, sector donut, per-pick rationale.

### 5. As an **SMB founder** — onboard (45s — Wow #3)
- Sign out, sign in as SMB, hit `/onboard`. Five turns of conversation, the right pane fills in real time.

### 6. **Trust + collateral verification** (15s)
- On any hero deal, scroll to **Collateral**. Six fixtures across the seeded companies show the AI verdict: matches-claim badge, plausibility, red flags. Each fixture is a real PDF — try downloading and re-uploading on the manage screen.

**Total: ~3 minutes. Six wow beats. AI on every step.**

---

## Architecture

```
┌────────────────────────────┐         ┌──────────────────────────────┐
│  Investor / SMB browsers   │  Clerk  │  Next.js 15 (App Router)     │
│                            │ ──────▶ │  • Server components (DB)    │
│                            │         │  • Streaming API routes      │
│                            │         │  • Role-aware middleware     │
└────────────────────────────┘         └──────┬───────────┬───────────┘
                                              │           │
                                              ▼           ▼
                                  ┌───────────────┐  ┌─────────────────┐
                                  │ SQLite        │  │  Mistral Large  │
                                  │ 12 tables     │  │  + Cerebras     │
                                  │               │  │    fallback     │
                                  └───────────────┘  └────┬────────────┘
                                                          │
                                          ┌───────────────┼─────────────────┐
                                          ▼               ▼                 ▼
                                     Tavily          fetchUrl         SIRENE V3
                                  (web search)      (HTTP+50KB)     (FR registry)
```

### Routing groups

- `app/(smb)/*` — SMB-only (`/dashboard`, `/onboard`)
- `app/(investor)/*` — investor-only (`/feed`, `/matches`, `/portfolio`)
- `app/campaign/[id]`, `app/company/[id]` — both roles
- `app/api/*` — gated by `middleware.ts`

### Data model

- **users** — Clerk-linked, role + display name
- **companies** — name, sector, country, traction, pitch, website (1 founder → N companies)
- **campaigns** — title, capital_seeking, use_of_funds, status `open` | `closed` | `funded`
- **collaterals** — type, declared_value, document_url, ai_score, ai_verdict_json
- **investors** — thesis text + structured (sectors, countries, stages, ticket range, risk)
- **dd_briefs**, **portfolio_proposals**, **match_caches** — cached AI outputs
- **ratings** — bidirectional 1–5 stars + named dimensions
- **conversations**, **onboarding_profiles** — onboarding transcripts and progress
- **interactions** — read-receipt-style logs

---

## API surface

| Method · Path | Purpose | Auth |
|---|---|---|
| `POST /api/smb/onboard` | Streaming onboarding chat | SMB |
| `POST /api/smb/extract` | Mid-chat partial extraction | SMB |
| `POST /api/smb/finalize` | Write company + first campaign from transcript | SMB |
| `POST /api/company/[id]/campaigns` | Add another campaign | SMB owner |
| `GET /api/company/[id]/dd` | Cached or fresh DD brief | Investor |
| `GET /api/company/[id]/dd/stream` | Live agent trace + brief | Investor |
| `POST /api/campaign/[id]/collateral` | Upload + AI verify a PDF | SMB owner |
| `GET /api/uploads/[name]` | Auth-gated file serving | Either |
| `POST /api/investor/thesis` | Save thesis | Investor |
| `POST /api/investor/portfolio` | Run portfolio constructor | Investor |
| `GET /api/match` · `/api/match/stream` | Curated feed + live ranking | Investor |
| `POST /api/parse-query` | Natural language → structured filters | Either |
| `POST /api/rate` | Submit a rating | Either |

---

## Reliability posture

- **Temperature 0** for every structured-output call. Higher only on the conversational onboarding chat.
- **Zod-validates every LLM JSON output** with one retry on schema failure.
- **Cerebras Llama 3.3 70B fallback** on Mistral failure — wired across all demo-critical paths via `lib/ai/client.ts:withModelFallback`.
- **Cached results in DB** for DD briefs, portfolio proposals, and match results — a flaky network never breaks the demo.
- **Hero DD briefs pre-generated** with `scripts/precache-dd.ts`.
- **Pre-baked collateral verdicts** in the seed — six fixtures show the AI verifier output without burning a live LLM call to load the page.

---

## Out of MVP — explicitly deferred

- Real escrow / capital flow
- Smart contracts / on-chain anything
- Email notifications, weekly digests
- Real-time investor↔SMB chat
- Investor accreditation checks
- Mobile responsiveness past basic

---

## Devpost submission copy

**Title** — Loanly: AI-native marketplace for European SMBs and thesis-driven investors

**Tagline** *(≤200 chars)* — Mistral-powered marketplace matching non-tech European SMBs raising capital with the right investors. AI handles sourcing, due diligence, portfolio construction, and collateral verification.

**Tech tags** — `Mistral AI` · `Vercel AI SDK` · `Next.js 15` · `Tailwind v4` · `shadcn/ui` · `Clerk` · `SQLite` · `Tavily` · `SIRENE / INSEE` · `Cerebras` · `Zod` · `TypeScript`

**Inspiration** — 25 million European SMBs are economic engines invisible to AngelList — agencies, makers, manufacturers, B2B services. They raise €50k–500k tickets from regional angels and family offices, who themselves can't deploy at scale without 50 hours of analyst work per deal. AI changes that economics.

**What it does** — Loanly is a two-sided marketplace where founders onboard via a conversation (no 50-field form), each deal ships with an AI-generated DD brief sourced from web + registry + the company's own site, big-ticket investors get fractionalised portfolios across 10–20 SMBs in seconds, and uploaded collateral PDFs are automatically verified.

**How we built it** — Next.js 15 App Router, Vercel AI SDK v6 with Mistral Large 2 (Cerebras Llama 3.3 70B as automatic fallback), tool-calling agent for DD with Tavily web search and SIRENE registry, Zod-validated structured outputs everywhere, SQLite for everything, Clerk for auth, shadcn/ui for the polish.

**Challenges** — Schema migration mid-build to support multi-company + multi-campaign + collaterals; live-streaming the DD agent's tool calls and the matching ranker's intermediate output; making the agent cite real URLs (not bare domains) by extracting them from research steps and pinning them to the structuring prompt.

**Accomplishments** — All four AI features built end-to-end in 24h plus an entire collateral verification subsystem (PDF parse → Mistral verdict). Every wow moment in the demo path is under 5 seconds, including the freshly-streamed DD agent visibly searching, fetching, and registry-checking before structuring its findings.

**What's next** — Real-time investor↔SMB messaging, escrow integration, multi-country registry coverage (Companies House UK, Handelsregister DE, RC Spain), audit trail for AI-assisted decisions, weekly thesis-aware digest emails.

---

## Repo structure

```
loanly/
├── app/
│   ├── layout.tsx                       # Clerk provider, fonts
│   ├── page.tsx                         # Landing
│   ├── icon.svg                         # Favicon
│   ├── (smb)/                           # SMB-only group
│   │   ├── dashboard/page.tsx
│   │   └── onboard/                     # Conversational onboarding
│   ├── (investor)/                      # Investor-only group
│   │   ├── feed/                        # Browse open campaigns
│   │   ├── matches/                     # Thesis editor + ranked picks
│   │   └── portfolio/                   # Constructor + sector donut
│   ├── company/[id]/                    # Company profile
│   │   └── new-campaign/                # Add a campaign
│   ├── campaign/[id]/                   # Deal detail (DD + collateral + rate)
│   │   └── manage/                      # Owner-only collateral upload
│   ├── select-role/
│   └── api/                             # Streaming + non-streaming routes
├── lib/
│   ├── db.ts                            # better-sqlite3 + helpers
│   ├── auth.ts                          # Clerk + role gating
│   ├── format.ts                        # EUR + humanize helpers
│   ├── ai/                              # client, dd-analyst, match,
│   │                                    # portfolio, parse-query,
│   │                                    # onboarding-smb, collateral-verify
│   └── tools/                           # web-search, fetch-url,
│                                        # company-lookup, extract-pdf
├── components/
│   ├── ui/                              # Badge, Button, Card, SectorIcon
│   ├── DDBrief.tsx, DDSection.tsx       # Live agent trace + brief view
│   ├── PortfolioView.tsx                # Holdings + donut
│   ├── FilterChips.tsx, NaturalLanguageInput.tsx
│   ├── FeedFilters.tsx, RatingWidget.tsx, TopNav.tsx
├── scripts/
│   ├── db-bootstrap.ts                  # Schema only
│   ├── db-seed.ts                       # Companies, campaigns, collaterals
│   ├── _pdf.ts                          # Dependency-free PDF generator
│   └── precache-dd.ts                   # Hero DD pre-generation
└── data/                                # SQLite + uploaded PDFs (gitignored)
```

---

## Acknowledgements

Built on the shoulders of: **Mistral AI**, **Vercel AI SDK**, **Next.js**, **Clerk**, **Tavily**, **INSEE / SIRENE**, **Cerebras**, **shadcn/ui**, **Recharts**, **better-sqlite3**.
