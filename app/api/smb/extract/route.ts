import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { mistral, MODEL_LARGE } from "@/lib/ai/client";
import { SMBFieldsSchema } from "@/lib/ai/onboarding-smb";

export const runtime = "nodejs";
export const maxDuration = 30;

const EXTRACT_SYSTEM_PROMPT = `You are a structured-data extractor. Read the conversation between an investment associate and a founder. Return only the fields you have evidence for in the conversation. Set every other field to null.

Rules:
- Sector must be one of: b2b_services, agency, saas_micro, makers, retail, manufacturing, professional_services, ecommerce. Pick the closest match.
- Stage must be one of: pre_revenue (no MRR yet), early (some revenue/traction), growth (clearly scaling). Infer from numbers if possible.
- All money fields are whole EUR (no cents).
- Country must be a 2-letter ISO code (FR, DE, etc.).
- pitch_summary: only fill in once you have enough basics to write a coherent ~150-word pitch. Otherwise null.
- Don't invent data. If unsure, leave the field null.`;

export async function POST(req: Request) {
  const { transcript }: { transcript: string } = await req.json();
  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  try {
    const result = await generateObject({
      model: mistral(MODEL_LARGE),
      schema: SMBFieldsSchema,
      system: EXTRACT_SYSTEM_PROMPT,
      prompt: transcript,
      temperature: 0,
    });
    return NextResponse.json(result.object);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "extraction failed" },
      { status: 500 }
    );
  }
}
