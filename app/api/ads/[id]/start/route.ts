import { NextResponse } from "next/server";
import { getCurrentUser, clientMeta } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { startAdSession } from "@/lib/services/ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (user.role !== "MEMBER") return NextResponse.json({ error: "Member access only." }, { status: 403 });

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }

  const limited = rateLimit(`ad-start:${user.id}`, 12, 60 * 1000);
  if (!limited.ok) return NextResponse.json({ error: "Too many sessions. Please slow down." }, { status: 429 });

  const { id } = await ctx.params;
  try {
    const meta = await clientMeta();
    const result = await startAdSession(user.id, id, meta);
    return NextResponse.json({
      sessionId: result.session.id,
      status: result.session.status,
      watchedSeconds: Number(result.session.watched_seconds),
      requiredSeconds: Number(result.session.required_seconds),
      rewardCents: Number(result.session.reward_cents),
      resumed: result.resumed,
      videoUrl: result.ad.video_url,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to start this advertisement." },
      { status: 400 },
    );
  }
}
