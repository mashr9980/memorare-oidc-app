import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { createVerifier, challengeFor, createState, safeEqual } from "../lib/pkce";

describe("PKCE (RFC 7636)", () => {
  it("verifier is 43 base64url chars from 32 random bytes", () => {
    const v = createVerifier();
    expect(v).toHaveLength(43);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("verifiers are unique", () => {
    const seen = new Set(Array.from({ length: 200 }, createVerifier));
    expect(seen.size).toBe(200);
  });

  it("challenge = BASE64URL(SHA256(ASCII(verifier)))", () => {
    const v = createVerifier();
    const expected = createHash("sha256").update(v, "ascii").digest("base64url");
    expect(challengeFor(v)).toBe(expected);
  });

  it("matches the RFC 7636 Appendix B test vector", () => {
    expect(challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );
  });

  it("state is non-empty base64url and unique", () => {
    const s = createState();
    expect(s.length).toBeGreaterThanOrEqual(16);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(createState()).not.toBe(s);
  });
});

describe("state comparison", () => {
  it("accepts equal strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });
  it("rejects different strings and lengths", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });
});
