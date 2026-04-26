# Loanly

**AI-native marketplace for European SMBs and thesis-driven investors.**

Built at the **Paris Fintech Hackathon 2026** in 24 hours.

---

## What it does

A two-sided marketplace where:

- **Founders** onboard through a 5-turn AI conversation (no 50-field form), spin up multiple companies and campaigns, and raise capital on-chain.
- **Investors** describe their thesis in plain language, get a curated ranked feed of European SMBs, run AI due diligence on any deal in seconds, and let the platform construct a fractionalised portfolio across 10–20 picks.
- **Capital actually moves** — each campaign deploys a real Solidity escrow on a local EVM. Investors commit mock-EURC, the contract auto-disburses to the SMB at target, and pro-rata principal+interest is paid back on repayment. Custodial wallets per Clerk user, zero crypto knowledge required.

---

## Key features

| # | Feature | What it does |
|---|---|---|
| 1 | **Conversational SMB onboarding** | 5-turn chat extracts company, traction, and campaign details; right pane materialises the structured profile live. |
| 2 | **AI due-diligence agent** | Tool-calling agent (Tavily web search · page fetch · SIRENE registry) produces an analyst-style brief with risk flags and **real cited URLs**. Tool trace streams to the UI as it runs. |
| 3 | **AI portfolio constructor** | Capital + risk + sectors → SQL hard-filter → fit-score → Mistral re-ranks and allocates. Sector donut, per-pick rationale, in <20s. |
| 4 | **Live thesis matching** | Top-N ranked deals with one-line reasoning per pick. Cached per investor, refreshed on thesis edit. |
| 5 | **On-chain contract lifecycle** | Per-campaign Solidity escrow on a local Hardhat node. End-to-end: deploy → commit → auto-fund → pro-rata repay. Every event indexed in SQLite and rendered in a per-campaign timeline. |
| 6 | **Collateral upload + AI verification** | Upload a PDF → text extraction → AI verifies the founder's claim, scores plausibility 0–100, surfaces concrete red flags. |
| 7 | **Bidirectional ratings** | Airbnb-style trust layer with named dimensions (responsiveness, info quality). |

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Recharts |
| Backend | Next.js API routes (Node runtime) |
| DB | SQLite via `better-sqlite3` |
| Auth | Clerk |
| AI | Mistral Large 2 (primary) · Cerebras Llama 3.3 70B (automatic fallback) via Vercel AI SDK v6 |
| Web search | Tavily · SIRENE V3.11 (FR registry) · `pdf-parse` |
| On-chain | Solidity 0.8.24 · Hardhat (compile + local node) · viem · custodial wallets (AES-256-GCM at rest) · mock EURC ERC-20 |

---

## Quick start

```bash
# 1. install
pnpm install

# 2. env
cp .env.example .env.local
# fill in CLERK keys, MISTRAL_API_KEY, TAVILY_API_KEY
# (CEREBRAS_API_KEY and SIRENE_API_TOKEN are optional)

# 3. database (schema + 20 companies / 20 campaigns / 5 investors / 6 collaterals with real PDFs)
pnpm db:reset
pnpm db:seed

# 4. on-chain (real EVM, no real money — local Hardhat node + mock EURC)
pnpm chain:compile          # one-time, generates contracts/artifacts/
pnpm chain:node             # terminal A — keeps the local EVM running
pnpm chain:deploy           # terminal B — deploys MockEUR + LoanlyMarketplace,
                            # writes data/chain.json

# 5. dev server
pnpm dev                    # http://localhost:3000
```

If you restart the Hardhat node, run `pnpm chain:reset` to wipe stale wallet/contract/event rows and redeploy.

### Required env vars

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
MISTRAL_API_KEY=...
TAVILY_API_KEY=tvly-...

# optional
CEREBRAS_API_KEY=csk-...
SIRENE_API_TOKEN=...

# chain (defaults work out of the box against the local Hardhat node)
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
OPERATOR_PRIVATE_KEY=0xac09...ff80    # Hardhat dev account #0
OPERATOR_ENCRYPTION_KEY=0x4c6f616e6c79446576456e6372797074696f6e4b657931323334353637383930
```

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev / production build / serve |
| `pnpm db:bootstrap` · `pnpm db:reset` · `pnpm db:seed` | Schema · wipe+rebuild · re-seed fixtures |
| `pnpm chain:compile` · `pnpm chain:node` · `pnpm chain:deploy` · `pnpm chain:reset` | Compile contracts · run local EVM · deploy · wipe+redeploy |
| `pnpm chain:e2e` | End-to-end on-chain lifecycle test (deploy → 2 commits → auto-fund → repay → assert pro-rata payouts) |
| `pnpm chain:scenarios` | Edge-case scenarios: cancel+refund, partial repay, repeat-commit |
| `pnpm exec tsc --noEmit` | Type-check the whole project |

---

## How the on-chain layer works

`contracts/LoanlyMarketplace.sol` is a single factory + escrow contract. Each campaign is a struct keyed by `keccak256(uuid)` with state machine `Open → Funded → Repaying → Repaid` (plus `Cancelled` from `Open`).

- **Custodial wallets** — every Clerk user gets a server-managed EVM wallet, private key encrypted with AES-256-GCM. Investors are auto-funded with €1,000,000 mock EURC; SMBs receive funds when their target is hit.
- **Auto-fund** — `commit` checks if `totalCommitted == target` and immediately disburses the escrow to the borrower in the same tx.
- **Pro-rata repay** — `repay` splits the amount across investors weighted by their commitment; the last investor absorbs integer-division dust so no funds are stranded.
- **Cancellation** — borrower or operator can cancel an `Open` campaign and `_refundAll` reverses every commitment.

Backend reconciles on-chain state into SQLite (`campaign_contracts`, `commitments`, `chain_events`) on every API write and on every contract read, so the UI always shows live numbers. Status, totals, and the per-campaign timeline you see in the UI all come from indexed events.

### The 3-minute demo

1. **SMB creates a campaign** with a target of e.g. €100,000, then clicks **Initiate on-chain contract** (8% interest, 90 days, 30-day commit deadline). Real Solidity is deployed; tx hash appears.
2. **Investor A** opens the same campaign — wallet pill in the top nav shows €1,000,000 mock EURC. Click **Commit** with €40,000. Progress bar updates, timeline gains an event.
3. **Investor B** commits the remaining €60,000 → contract **auto-disburses** the full €100k to the SMB in the same tx. Status flips to **Funded**.
4. **SMB clicks Repay** → contract pushes pro-rata principal+interest. Status flips to **Repaid**, both investors see realised return on `/portfolio`. Full timeline visible: `Created → Committed × 2 → Funded → InvestorPaid × 2 → Repaid`.

---

## Architecture

```
┌────────────────────────────┐         ┌──────────────────────────────┐
│  Investor / SMB browsers   │  Clerk  │  Next.js 15 (App Router)     │
│                            │ ──────▶ │  • Server components (DB)    │
│                            │         │  • Streaming API routes      │
│                            │         │  • Role-aware middleware     │
└────────────────────────────┘         └──────┬──────────┬────────────┘
                                              │          │
                            ┌─────────────────┘          └──────────────┐
                            ▼                ▼                          ▼
                  ┌────────────────┐  ┌──────────────────┐   ┌────────────────────┐
                  │  SQLite        │  │  Mistral Large 2 │   │  Hardhat EVM       │
                  │  16 tables     │  │  + Cerebras      │   │  • LoanlyMarketplace│
                  │  (incl. chain  │  │  fallback        │   │  • MockEUR ERC-20  │
                  │  cache)        │  └──────┬───────────┘   │  • viem TS client  │
                  └────────────────┘         │               └────────────────────┘
                                             ▼
                                Tavily · SIRENE · fetchUrl · pdf-parse
```

### Data model

- **users · companies · campaigns** — Clerk-linked founder profiles, multi-company support, status `open` | `closed` | `funded`.
- **collaterals** — type, declared value, document URL, AI score + verdict.
- **investors · dd_briefs · portfolio_proposals · match_caches** — thesis + cached AI outputs.
- **wallets** — Clerk user → EVM address + AES-256-GCM encrypted private key (custodial, lazy-provisioned).
- **campaign_contracts** — on-chain terms cache (target, interest_bps, duration, deadline, totals, `on_chain_state`).
- **commitments** — investor stakes (amount, tx hash, status, repaid amount).
- **chain_events** — append-only audit log of every emitted event, powers the timeline UI.
- **ratings · interactions · conversations · onboarding_profiles** — trust + transcripts.

### API surface (selection)

| Method · Path | Purpose | Auth |
|---|---|---|
| `POST /api/smb/onboard` · `extract` · `finalize` | Streaming onboarding chat + finalise | SMB |
| `GET /api/company/[id]/dd` · `dd/stream` | Cached or live AI due diligence | Investor |
| `POST /api/campaign/[id]/collateral` | Upload + AI verify a PDF | SMB owner |
| `POST /api/investor/thesis` · `portfolio` | Save thesis · run portfolio constructor | Investor |
| `GET /api/match` · `match/stream` | Curated feed + live ranking | Investor |
| `GET /api/chain/wallet` | Custodial wallet `{ address, balanceEur, balanceEth }` | Either |
| `GET · POST /api/campaign/[id]/contract` | Read terms+commitments+events · SMB initiates | Either · SMB |
| `POST /api/campaign/[id]/commit` · `repay` · `cancel` | Investor commits · SMB repays · SMB cancels | Investor · SMB · SMB |

---

## Reliability posture

- **Temperature 0** for every structured-output call.
- **Zod-validates every LLM JSON output** with one retry on schema failure.
- **Cerebras fallback** wired across all demo-critical paths.
- **Cached results in DB** for DD briefs, portfolio proposals, and match results.
- **Pre-baked collateral verdicts** in the seed (no live LLM call needed to load demo pages).
- **Pre-cached hero DD briefs** via `pnpm exec tsx --env-file=.env.local scripts/precache-dd.ts`.

---

## Out of MVP

- Public-testnet / mainnet deployment (we ship a local Hardhat node + mock EURC for the demo — no funds at risk).
- Email notifications, real-time chat, investor accreditation checks, mobile responsiveness past basic.
