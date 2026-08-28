import { NextRequest, NextResponse } from "next/server";
import { COOKIE } from "@/lib/cookies";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authBase = process.env.AUTH_BASE ?? "https://auth.memorare.ai";
  const appUrl = process.env.APP_URL ?? req.nextUrl.origin;

  const target = new URL(`${authBase.replace(/\/$/, "")}/logout`);
  target.searchParams.set("return_to", `${appUrl.replace(/\/$/, "")}/`);

  const res = NextResponse.redirect(target.toString());
  res.cookies.delete(COOKIE.session);
  return res;
}
