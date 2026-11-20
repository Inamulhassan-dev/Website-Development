import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { completeAdSession } from "@/lib/services/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const limited = rateLimit(`ad-complete:${user.id}`, 30, 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });

  const { id } = await ctx.params;
  const result = await completeAdSession(user.id, id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
