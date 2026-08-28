import { describe, expect, it } from "vitest";
import { avatarKey, isSafeSub, sniffImageType } from "../lib/avatar-rules";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);

describe("sniffImageType", () => {
  it("recognises the three formats the provider accepts", () => {
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(webp)).toBe("image/webp");
  });

  it("rejects SVG even when the browser calls it a PNG", () => {
    expect(sniffImageType(new Uint8Array(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
  });

  it("rejects HTML and truncated files", () => {
    expect(sniffImageType(new Uint8Array(Buffer.from("<!doctype html><script>")))).toBeNull();
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("isSafeSub", () => {
  it("accepts provider subject formats", () => {
    expect(isSafeSub("123")).toBe(true);
    expect(isSafeSub("g-100")).toBe(true);
    expect(isSafeSub("auth0_user-9")).toBe(true);
  });

  it("refuses anything that could escape the key prefix", () => {
    for (const bad of ["../../etc/passwd", "a/b", "", "a".repeat(65), "a b", "a.b"]) {
      expect(isSafeSub(bad), bad).toBe(false);
    }
  });

  it("confines every accepted subject to the avatars prefix", () => {
    expect(avatarKey("g-100")).toBe("avatars/g-100.webp");
  });
});
