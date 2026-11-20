import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { reportProgress } from "@/lib/services/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const limited = rateLimit(`ad-progress:${user.id}`, 240, 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: "Too many progress updates." }, { status: 429 });

  const { id } = await ctx.params;
  let payload: { deltaSeconds?: number; hidden?: boolean } = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }
  const result = await reportProgress({
    userId: user.id,
    sessionId: id,
    deltaSeconds: Number(payload.deltaSeconds ?? 0),
    hidden: Boolean(payload.hidden),
  });
  if (!result.ok && result.code === "NOT_FOUND") {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  return NextResponse.json(result);
}
