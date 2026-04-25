import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { randomUUID } from "node:crypto";
import { withModelFallback } from "@/lib/ai/client";
import {
  SMBFieldsSchema,
  missingForFinalize,
  type SMBFields,
} from "@/lib/ai/onboarding-smb";
import { requireRole } from "@/lib/auth";
import {
  createCampaign,
  createCompany,
  getDb,
  listCompaniesByUserId,
} from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const FINALIZE_SYSTEM_PROMPT = `You are producing the final structured listing from an onboarding conversation between an investment associate and a small-business founder.

Rules:
- Sector is one of: b2b_services, agency, saas_micro, makers, retail, manufacturing, professional_services, ecommerce. Pick the closest match.
- Stage is one of: pre_revenue, early, growth. Infer from numbers.
- All money fields are whole EUR (no cents).
- Country is a 2-letter ISO code.
- pitch_summary: write the founder's voice, 120-180 words, British English, plain prose (no bullet points, no headings). Cover: what the company does, their traction (numbers if shared), what they're raising, and what they'll use it for.
- Set fields to null only if truly absent from the conversation.
- Be honest about what's in the transcript — don't invent traction or details.`;

export async function POST(req: Request) {
  const user = await requireRole("smb");

  const { transcript }: { transcript: string } = await req.json();
  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  let fields: SMBFields | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2 && !fields; attempt++) {
    try {
      const result = await withModelFallback((model) =>
        generateObject({
          model,
          schema: SMBFieldsSchema,
          system: FINALIZE_SYSTEM_PROMPT,
          prompt: transcript,
          temperature: 0,
          maxRetries: 3,
        })
      );
      fields = result.object;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!fields) {
    return NextResponse.json(
      { error: "extraction failed", detail: String(lastErr) },
      { status: 500 }
    );
  }

  const missing = missingForFinalize(fields);
  if (missing.length) {
    return NextResponse.json(
      { error: "incomplete", missing, fields },
      { status: 400 }
    );
  }

  const company = createCompany({
    user_id: user.id,
    name: fields.name!,
    sector: fields.sector,
    stage: fields.stage ?? "early",
    country: fields.country,
    city: fields.city,
    founded_year: fields.founded_year,
    team_size: fields.team_size,
    monthly_revenue_eur: fields.monthly_revenue_eur,
    monthly_burn_eur: fields.monthly_burn_eur,
    pitch: fields.pitch_summary!,
    website: fields.website,
  });

  const campaign = createCampaign({
    company_id: company.id,
    title: `Initial raise — ${formatEur(fields.capital_seeking_eur!)}`,
    capital_seeking_eur: fields.capital_seeking_eur!,
    use_of_funds: fields.use_of_funds!,
    pitch_summary: fields.pitch_summary!,
    status: "open",
  });

  // Save the conversation transcript for replay/audit.
  getDb()
    .prepare(
      `INSERT INTO conversations (id, user_id, type, messages_json, extracted_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      user.id,
      "smb_onboarding",
      JSON.stringify({ transcript }),
      JSON.stringify(fields),
      Date.now()
    );

  return NextResponse.json({
    ok: true,
    companyId: company.id,
    campaignId: campaign.id,
    isFirstCompany: listCompaniesByUserId(user.id).length === 1,
  });
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
