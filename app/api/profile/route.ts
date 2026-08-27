import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { patchProfile } from "@/lib/memorare";

export const dynamic = "force-dynamic";

/**
 * Proxies the name update. The browser never holds the access token, and the
 * response is narrowed to safe fields so nothing sensitive can leak through.
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name =
    typeof (body as { name?: unknown })?.name === "string"
      ? (body as { name: string }).name.trim()
      : "";

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: "name_too_long" }, { status: 400 });

  try {
    const updated = await patchProfile(session.accessToken, name);
    return NextResponse.json({ name: updated.name ?? name });
  } catch (err) {
    console.error("[api/profile] update failed", err);
    return NextResponse.json({ error: "update_failed" }, { status: 502 });
  }
}
