import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe for systemd and the proxy. Deliberately leaks nothing. */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
