import { NextRequest, NextResponse } from "next/server";
import { isSecureRequest } from "@/lib/cookies";
import { publicOrigin } from "@/lib/origin";
import { startAuthorize } from "@/lib/authorize";

export const dynamic = "force-dynamic";

function begin(req: NextRequest, email: string | null, google: boolean) {
  try {
    if (google) return startAuthorize({ google: true }, isSecureRequest(req));
    if (!email) return NextResponse.redirect(`${publicOrigin(req)}/?error=email_required`, { status: 303 });
    return startAuthorize({ email }, isSecureRequest(req));
  } catch (err) {
    console.error("[auth/login] configuration error", err);
    return NextResponse.redirect(`${publicOrigin(req)}/?error=server_misconfigured`, { status: 303 });
  }
}

/**
 * Email sign-in is POST only. A GET would put the address in browser history and
 * proxy logs, and a link prefetcher following it would make the provider send an
 * OTP nobody asked for.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.redirect(`${publicOrigin(req)}/?error=email_required`, { status: 303 });
  const email = String(form.get("email") ?? "").trim();
  const google = String(form.get("idp") ?? "") === "google";
  return begin(req, email || null, google);
}

/** Kept for the Google button, which carries no personal data. */
export async function GET(req: NextRequest) {
  return begin(req, null, req.nextUrl.searchParams.get("idp") === "google");
}
