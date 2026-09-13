import { NextRequest, NextResponse } from "next/server";
import { cancelJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cancelled = cancelJob(id);
  return NextResponse.json({ cancelled });
}
