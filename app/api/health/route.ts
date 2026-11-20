import { NextResponse } from "next/server";
import { scalar } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await scalar("SELECT 1 AS ok");
    return NextResponse.json({
      status: "ok",
      database: "connected",
      demo: true,
      simulatedPayments: true,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: "error", database: "unavailable" }, { status: 503 });
  }
}
