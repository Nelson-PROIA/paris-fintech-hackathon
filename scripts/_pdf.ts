import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Tiny dependency-free PDF generator.
 *
 * Produces a single-page A4 PDF in the simplest valid form (PDF 1.4) — a
 * Catalog → Pages → Page → Contents stream with one Helvetica font. Enough
 * for `pdf-parse` to extract the text we wrote, which is all the seed cares
 * about. We don't need fancy layout: this is for collateral fixtures that
 * the AI verifier reads, not for end-user reading.
 *
 * The trick with hand-rolled PDFs is the xref table — its byte offsets
 * MUST match the actual on-disk positions of each `<n> 0 obj` block. We
 * build the body as an array of object strings, track each object's start
 * byte, then emit the xref at the end.
 */

function escape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function buildPdf(opts: {
  title: string;
  lines: string[];
}): Buffer {
  const lines = [`/F1 14 Tf`, `(${escape(opts.title)}) Tj`, `0 -22 Td`, `/F1 11 Tf`];
  for (const ln of opts.lines) {
    lines.push(`(${escape(ln)}) Tj`);
    lines.push(`0 -16 Td`);
  }
  const stream =
    "BT\n" +
    "72 760 Td\n" +
    lines.join("\n") +
    "\nET";
  const streamBytes = Buffer.byteLength(stream, "latin1");

  const objects = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 595 842] /Contents 5 0 R >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`,
    `<< /Length ${streamBytes} >>\nstream\n${stream}\nendstream`,
  ];

  let body = "%PDF-1.4\n%\xC1\xC2\xC3\xC4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += `0000000000 65535 f \n`;
  for (const off of offsets) {
    body += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(body, "latin1");
}

export function writePdf(outDir: string, filename: string, content: { title: string; lines: string[] }): string {
  mkdirSync(outDir, { recursive: true });
  const fullPath = path.join(outDir, filename);
  writeFileSync(fullPath, buildPdf(content));
  return fullPath;
}
