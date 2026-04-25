import { NextResponse } from "next/server";
import { setUserRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const type = (body as { type?: string }).type;
  if (type !== "smb" && type !== "investor") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  try {
    const user = await setUserRole(type);
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
