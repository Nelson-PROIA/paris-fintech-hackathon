import path from "node:path";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";

const UPLOAD_DIR = path.resolve("./data/uploads");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  await requireUser();
  const { name } = await params;
  if (name.includes("/") || name.includes("..")) {
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  }
  const fullPath = path.join(UPLOAD_DIR, name);
  if (!fullPath.startsWith(UPLOAD_DIR)) {
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  }
  try {
    const buf = await fs.readFile(fullPath);
    const ext = path.extname(name).toLowerCase();
    const contentType =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
