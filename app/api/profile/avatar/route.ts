import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/session";
import { serverConfig } from "@/lib/config";
import { patchProfile } from "@/lib/memorare";
import { AVATAR_MAX_BYTES, AVATAR_TYPES, isSafeSub, sniffImageType } from "@/lib/avatar-rules";
import { deleteAvatar, putAvatar, storageConfigured } from "@/lib/avatar-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/** Forward the original file to the provider's own endpoint when S3 is not set up. */
async function forwardToProvider(accessToken: string, bytes: Uint8Array, type: string, filename: string) {
  const cfg = serverConfig();
  const body = new FormData();
  body.append("avatar", new Blob([bytes as BlobPart], { type }), filename);

  const res = await fetch(`${cfg.authBase}/api/profile/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("token_expired");
  if (!res.ok) {
    console.error("[api/profile/avatar] provider upload failed", res.status, await res.text());
    throw new Error("upload_failed");
  }
  const json = (await res.json()) as { profile?: { picture?: string | null } } | { picture?: string | null };
  const profile = (json as { profile?: unknown }).profile ?? json;
  return (profile as { picture?: string | null }).picture ?? null;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return bad("unauthorized", 401);
  if (!isSafeSub(session.sub)) return bad("unsupported_subject", 400);

  const form = await req.formData().catch(() => null);
  if (!form) return bad("invalid_multipart");

  const file = form.get("avatar");
  if (!(file instanceof File)) return bad("avatar_required");
  if (file.size > AVATAR_MAX_BYTES) return bad("file_too_large", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength === 0) return bad("avatar_required");
  if (bytes.byteLength > AVATAR_MAX_BYTES) return bad("file_too_large", 413);

  const sniffed = sniffImageType(bytes);
  if (!sniffed || !AVATAR_TYPES.includes(sniffed as (typeof AVATAR_TYPES)[number])) {
    return bad("unsupported_image_type", 415);
  }

  try {
    if (!storageConfigured()) {
      const picture = await forwardToProvider(session.accessToken, bytes, sniffed, file.name || "avatar");
      return NextResponse.json({ ok: true, picture, storage: "provider" }, { status: 201 });
    }

    // Re-encoding normalises the format and drops EXIF, including GPS coordinates
    // that phone cameras attach to photos.
    const webp = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();

    const version = await putAvatar(session.sub, new Uint8Array(webp));
    const picture = `${serverConfig().appUrl.replace(/\/$/, "")}/api/avatar/${session.sub}?v=${version}`;

    await patchProfile(session.accessToken, { picture });
    return NextResponse.json({ ok: true, picture, storage: "s3" }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "token_expired") return bad("token_expired", 401);
    console.error("[api/profile/avatar] upload failed", err);
    return bad("upload_failed", 502);
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return bad("unauthorized", 401);
  if (!isSafeSub(session.sub)) return bad("unsupported_subject", 400);

  try {
    if (storageConfigured()) await deleteAvatar(session.sub);
    await patchProfile(session.accessToken, { picture: null });
    return NextResponse.json({ ok: true, picture: null });
  } catch (err) {
    if (err instanceof Error && err.message === "token_expired") return bad("token_expired", 401);
    console.error("[api/profile/avatar] delete failed", err);
    return bad("delete_failed", 502);
  }
}
