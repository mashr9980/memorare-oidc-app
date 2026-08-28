import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { sealSession, unsealSession, type Session } from "../lib/session";

const sample: Session = {
  sub: "123",
  email: "user@example.com",
  name: "Test User",
  picture: null,
  accessToken: "secret-access-token-value",
};

beforeAll(() => {
  process.env.SESSION_SECRET = "unit-test-session-secret-0123456789abcdef";
});

describe("session sealing (JWE)", () => {
  it("round-trips a session", async () => {
    const sealed = await sealSession(sample, 3600);
    const out = await unsealSession(sealed);
    expect(out?.email).toBe(sample.email);
    expect(out?.accessToken).toBe(sample.accessToken);
  });

  it("output is encrypted: token is not readable in the cookie value", async () => {
    const sealed = await sealSession(sample, 3600);
    expect(sealed).not.toContain(sample.accessToken);
    expect(sealed).not.toContain(sample.email);
    const parts = sealed.split(".");
    expect(parts.length).toBe(5); // JWE compact = 5 segments
  });

  it("rejects tampered tokens", async () => {
    const sealed = await sealSession(sample, 3600);
    const tampered = sealed.slice(0, -4) + "AAAA";
    expect(await unsealSession(tampered)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await unsealSession("garbage.not.a.jwe")).toBeNull();
  });

  it("rejects tokens sealed with a different key", async () => {
    const sealed = await sealSession(sample, 3600);
    process.env.SESSION_SECRET = "a-completely-different-secret-0987654321";
    expect(await unsealSession(sealed)).toBeNull();
    process.env.SESSION_SECRET = "unit-test-session-secret-0123456789abcdef";
  });
});
