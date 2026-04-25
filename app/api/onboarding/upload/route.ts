import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  appendOnboardingDocument,
  updateOnboardingDocument,
  type OnboardingType,
} from "@/lib/db";
import { classifyDocument } from "@/lib/onboarding/document-classify";

export const runtime = "nodejs";
export const maxDuration = 60;

const UPLOAD_DIR = path.resolve("./data/uploads");
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

function parseProfileType(value: unknown): OnboardingType | null {
  if (value === "smb" || value === "investor") return value;
  return null;
}

export async function POST(req: Request) {
  const user = await requireUser();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid multipart" }, { status: 400 });
  }

  const profileType = parseProfileType(form.get("profileType"));
  if (!profileType) {
    return NextResponse.json({ error: "profileType required" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported mime: ${file.type}` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const id = randomUUID();
  const ext = extFromMime(file.type);
  const storedName = `${id}${ext}`;
  const fullPath = path.join(UPLOAD_DIR, storedName);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buf);

  const document = {
    id,
    filename: file.name,
    url: `/api/uploads/${storedName}`,
    mime: file.type,
    size: file.size,
    category: null as string | null,
    uploaded_at: Date.now(),
  };
  appendOnboardingDocument(user.id, profileType, document);

  // Background classification — don't await, but capture errors silently.
  void classifyDocument({
    filePath: fullPath,
    filename: file.name,
    profileType,
  })
    .then((cls) => {
      if (cls.confidence > 0.4) {
        updateOnboardingDocument(user.id, profileType, id, {
          category: cls.category,
        });
      }
    })
    .catch(() => undefined);

  return NextResponse.json({ document });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { profileType: rawType, documentId, category } = body as {
    profileType?: unknown;
    documentId?: unknown;
    category?: unknown;
  };
  const profileType = parseProfileType(rawType);
  if (!profileType) {
    return NextResponse.json({ error: "profileType required" }, { status: 400 });
  }
  if (typeof documentId !== "string") {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }
  if (category != null && typeof category !== "string") {
    return NextResponse.json(
      { error: "category must be string" },
      { status: 400 }
    );
  }
  updateOnboardingDocument(user.id, profileType, documentId, {
    category: typeof category === "string" ? category : null,
  });
  return NextResponse.json({ ok: true });
}

function extFromMime(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return ".pdf";
    case "image/png":
      return ".png";
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    default:
      return "";
  }
}
