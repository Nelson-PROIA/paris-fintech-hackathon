import { NextResponse } from "next/server";
import { z } from "zod";
import { parseFeedQuery, parsePortfolioQuery } from "@/lib/ai/parse-query";

export const runtime = "nodejs";
export const maxDuration = 30;

const RequestSchema = z.object({
  kind: z.enum(["portfolio", "feed"]),
  text: z.string().min(1).max(2000),
  allowedSectors: z.array(z.string()).default([]),
  allowedCountries: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { kind, text, allowedSectors, allowedCountries } = parsed.data;

  try {
    const result =
      kind === "portfolio"
        ? await parsePortfolioQuery(text, allowedSectors, allowedCountries)
        : await parseFeedQuery(text, allowedSectors, allowedCountries);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        error: "Parse failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
