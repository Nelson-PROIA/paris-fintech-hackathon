import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { submitRating } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 15;

const RateSchema = z.object({
  ratedUserId: z.string().min(1),
  ratedType: z.enum(["smb", "investor"]),
  score: z.number().int().min(1).max(5),
  dimensions: z.record(z.string(), z.number().int().min(1).max(5)).optional(),
  comment: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = RateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (parsed.data.ratedUserId === user.id) {
    return NextResponse.json(
      { error: "Cannot rate yourself" },
      { status: 400 }
    );
  }
  submitRating({
    raterUserId: user.id,
    ratedUserId: parsed.data.ratedUserId,
    ratedType: parsed.data.ratedType,
    score: parsed.data.score,
    dimensions: parsed.data.dimensions,
    comment: parsed.data.comment,
  });
  return NextResponse.json({ ok: true });
}
