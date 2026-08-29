import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { COOKIE, HOST_SESSION, clearSessionCookies } from "../lib/cookies";

function header(res: NextResponse, name: string): string | undefined {
  return res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
}

describe("clearing the session cookies on sign out", () => {
  it("expires the __Host- cookie with Secure so the browser accepts the deletion", () => {
    const res = NextResponse.redirect("https://example.com/", { status: 303 });
    clearSessionCookies(res, true);

    const host = header(res, HOST_SESSION);
    expect(host).toBeDefined();
    // A __Host- Set-Cookie missing any of these three is dropped outright, which
    // leaves the visitor signed in after they click Sign out.
    expect(host).toMatch(/;\s*Secure/i);
    expect(host).toMatch(/;\s*Path=\//i);
    expect(host).not.toMatch(/;\s*Domain=/i);
    expect(host).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it("expires the plain-HTTP fallback cookie too", () => {
    const res = NextResponse.redirect("http://localhost:3000/", { status: 303 });
    clearSessionCookies(res, false);

    const plain = header(res, COOKIE.session);
    expect(plain).toBeDefined();
    expect(plain).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    // Over plain HTTP the browser would reject a Secure deletion.
    expect(plain).not.toMatch(/;\s*Secure/i);
  });

  it("clears both names regardless of scheme", () => {
    const res = NextResponse.redirect("https://example.com/", { status: 303 });
    clearSessionCookies(res, true);
    expect(header(res, HOST_SESSION)).toBeDefined();
    expect(header(res, COOKIE.session)).toBeDefined();
  });
});
