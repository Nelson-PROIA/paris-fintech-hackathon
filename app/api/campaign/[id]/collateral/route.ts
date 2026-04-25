import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import {
  createCollateral,
  getCampaignById,
  getCompanyById,
  setCollateralVerdict,
  type CollateralType,
} from "@/lib/db";
import { extractPdfText } from "@/lib/tools/extract-pdf";
import { verifyCollateral } from "@/lib/ai/collateral-verify";

export const runtime = "nodejs";
export const maxDuration = 90;

const UPLOAD_DIR = path.resolve("./data/uploads");

const COLLATERAL_TYPES = [
  "real_estate",
  "equipment",
  "contract",
  "inventory",
  "receivables",
  "other",
] as const;

const InputSchema = z.object({
  type: z.enum(COLLATERAL_TYPES),
  description: z.string().min(3).max(500),
  declaredValueEur: z.number().int().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("smb");
  const { id: campaignId } = await params;

  const camp = getCampaignById(campaignId);
  if (!camp) return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  const company = getCompanyById(camp.company_id);
  if (!company || company.user_id !== user.id) {
    return NextResponse.json(
      { error: "not your campaign" },
      { status: 403 }
    );
  }

  const form = await req.formData();
  const type = form.get("type");
  const description = form.get("description");
  const declaredValue = form.get("declaredValueEur");
  const file = form.get("file");

  const parsed = InputSchema.safeParse({
    type,
    description,
    declaredValueEur: declaredValue ? Number(declaredValue) : NaN,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let savedFilename: string | null = null;
  let savedUrl: string | null = null;
  let savedPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "file too large (max 10MB)" },
        { status: 400 }
      );
    }
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(file.name) || ".bin";
    const uniqueName = `${randomUUID()}${ext}`;
    savedPath = path.join(UPLOAD_DIR, uniqueName);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(savedPath, buf);
    savedFilename = file.name;
    savedUrl = `/api/uploads/${uniqueName}`;
  }

  const collateral = createCollateral({
    campaign_id: campaignId,
    type: parsed.data.type as CollateralType,
    description: parsed.data.description,
    declared_value_eur: parsed.data.declaredValueEur,
    document_filename: savedFilename,
    document_url: savedUrl,
  });

  // Trigger AI verification (sync, slow). Fail soft — don't roll back the collateral row.
  if (savedPath) {
    try {
      let docText = "";
      let extractOk = false;
      const lower = savedFilename?.toLowerCase() ?? "";
      if (lower.endsWith(".pdf")) {
        const ex = await extractPdfText(savedPath);
        docText = ex.text;
        extractOk = ex.ok;
      } else {
        // Non-PDF: read as text if small, else skip
        try {
          const txt = await fs.readFile(savedPath, "utf8");
          docText = txt;
          extractOk = txt.length > 0;
        } catch {
          extractOk = false;
        }
      }
      const verdict = await verifyCollateral({
        collateral: {
          type: parsed.data.type as CollateralType,
          description: parsed.data.description,
          declared_value_eur: parsed.data.declaredValueEur,
          document_filename: savedFilename,
        },
        documentText: docText,
        documentExtractOk: extractOk,
      });
      setCollateralVerdict(collateral.id, verdict.confidenceScore, verdict);
    } catch (e) {
      console.warn("[collateral] verify failed:", e);
    }
  }

  return NextResponse.json({ ok: true, collateralId: collateral.id });
}
