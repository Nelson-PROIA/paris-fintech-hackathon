import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { enrichField } from "@/lib/ai/onboarding-llm";
import type { LLMEnrichKind } from "@/lib/onboarding/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_KINDS: LLMEnrichKind[] = [
  "smb_activity_description",
  "smb_need_description",
  "smb_seasonality_note",
  "investor_thesis",
  "investor_exclusions",
];

export async function POST(req: Request) {
  await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { kind, raw, context } = body as {
    kind?: unknown;
    raw?: unknown;
    context?: unknown;
  };

  if (typeof kind !== "string" || !ALLOWED_KINDS.includes(kind as LLMEnrichKind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return NextResponse.json({ error: "raw text required" }, { status: 400 });
  }
  if (raw.length > 4_000) {
    return NextResponse.json({ error: "raw text too long" }, { status: 400 });
  }

  try {
    const result = await enrichField({
      kind: kind as LLMEnrichKind,
      raw,
      context:
        context && typeof context === "object" && !Array.isArray(context)
          ? (context as Record<string, unknown>)
          : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "enrichment failed" },
      { status: 500 }
    );
  }
}
