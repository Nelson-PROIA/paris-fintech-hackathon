import fs from "node:fs/promises";

const MAX_TEXT_BYTES = 50_000;

export type PdfExtractResult = {
  ok: boolean;
  text: string;
  pages?: number;
  truncated: boolean;
  reason?: string;
};

export async function extractPdfText(
  filePath: string
): Promise<PdfExtractResult> {
  try {
    const data = await fs.readFile(filePath);
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(data) });
    const result = await parser.getText();
    await parser.destroy().catch(() => {});
    const text = (result.text ?? "").trim();
    if (!text) {
      return {
        ok: false,
        text: "",
        truncated: false,
        reason: "empty_extraction",
      };
    }
    return {
      ok: true,
      text:
        text.length > MAX_TEXT_BYTES
          ? text.slice(0, MAX_TEXT_BYTES) + "\n…[truncated]"
          : text,
      pages: result.pages?.length,
      truncated: text.length > MAX_TEXT_BYTES,
    };
  } catch (e) {
    return {
      ok: false,
      text: "",
      truncated: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
