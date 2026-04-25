import { z } from "zod";
import { generateObject } from "ai";
import { mistral, MODEL_SMALL } from "@/lib/ai/client";
import { extractPdfText } from "@/lib/tools/extract-pdf";

const SMB_CATEGORIES = [
  "kbis",
  "invoices",
  "contracts",
  "balance_sheet",
  "bank_statements",
  "other",
] as const;

const INVESTOR_CATEGORIES = [
  "id_proof",
  "address_proof",
  "track_record",
  "mandate",
  "other",
] as const;

const SmbCategorySchema = z.object({
  category: z.enum(SMB_CATEGORIES),
  confidence: z.number().min(0).max(1),
});

const InvestorCategorySchema = z.object({
  category: z.enum(INVESTOR_CATEGORIES),
  confidence: z.number().min(0).max(1),
});

export type DocumentClassifyInput = {
  filePath: string;
  filename: string;
  profileType: "smb" | "investor";
};

export type DocumentClassifyResult = {
  category: string;
  confidence: number;
};

export async function classifyDocument(
  input: DocumentClassifyInput
): Promise<DocumentClassifyResult> {
  const { filename, filePath, profileType } = input;
  const isPdf = filename.toLowerCase().endsWith(".pdf");

  let snippet = "";
  if (isPdf) {
    const ex = await extractPdfText(filePath);
    if (ex.ok) snippet = ex.text.slice(0, 2_000);
  }

  const schema =
    profileType === "smb" ? SmbCategorySchema : InvestorCategorySchema;
  const allowed =
    profileType === "smb" ? SMB_CATEGORIES.join(", ") : INVESTOR_CATEGORIES.join(", ");

  try {
    const result = await generateObject({
      model: mistral(MODEL_SMALL),
      schema,
      system: `You classify a single uploaded document into ONE of these categories: ${allowed}. Return "other" if unclear. Use the filename and the text snippet.`,
      prompt: `Filename: ${filename}\n\nFirst page text snippet:\n"""${snippet || "(no text extracted)"}"""`,
      temperature: 0,
    });
    return result.object;
  } catch {
    return { category: "other", confidence: 0 };
  }
}
