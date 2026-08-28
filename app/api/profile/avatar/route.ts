import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { serverConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });

  const file = formData.get("avatar");
  if (!(file instanceof File)) return NextResponse.json({ error: "avatar_required" }, { status: 400 });

  const type = file.type;
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
    return NextResponse.json({ error: "invalid_image_type" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const cfg = serverConfig();
  const fwd = new FormData();
  fwd.append("avatar", new Blob([bytes], { type }), file.name);

  const res = await fetch(`${cfg.authBase}/api/profile/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.accessToken}` },
    body: fwd,
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[api/profile/avatar] upload failed", res.status, await res.text());
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }

  const json = (await res.json()) as { ok?: boolean; profile?: { picture?: string | null } };
  const profile = (json as { profile?: unknown }).profile ?? json;
  const picture = (profile as { picture?: string | null }).picture;

  return NextResponse.json({ ok: true, picture }, { status: 201 });
}
