import { NextRequest, NextResponse } from "next/server";
import { isSafeSub } from "@/lib/avatar-rules";
import { avatarDownloadUrl, storageConfigured, SIGNED_URL_TTL_SECONDS } from "@/lib/avatar-storage";

export const dynamic = "force-dynamic";

/**
 * Public, stable avatar URL. The bucket stays private: this hands out a
 * short-lived signed URL per request, so the address we store on the provider
 * profile never expires while the objects themselves are never world-readable.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ sub: string }> }) {
  if (!storageConfigured()) return new NextResponse("Not found", { status: 404 });

  const { sub } = await ctx.params;
  if (!isSafeSub(sub)) return new NextResponse("Not found", { status: 404 });

  try {
    const url = await avatarDownloadUrl(sub);
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": `public, max-age=${SIGNED_URL_TTL_SECONDS - 60}` },
    });
  } catch (err) {
    console.error("[api/avatar] sign failed", err);
    return new NextResponse("Not found", { status: 404 });
  }
}
