import { NextRequest, NextResponse } from "next/server";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Mirrors the YTDLP_COOKIES_FILE pattern: a plain file, overridable via env
// var so production can point it at a bind-mounted path that survives
// container rebuilds (see docker run in README's deploy runbook).
const WAITLIST_FILE = process.env.WAITLIST_FILE || path.join(process.cwd(), "waitlist.csv");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  try {
    const existing = await readFile(WAITLIST_FILE, "utf8").catch(() => "");
    if (!existing.includes(`${email},`)) {
      await appendFile(WAITLIST_FILE, `${email},${new Date().toISOString()}\n`);
    }
    // Same response whether they're new or already on the list — don't
    // reveal which, no reason to leak that.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
