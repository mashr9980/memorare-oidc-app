import { expect, test } from "@playwright/test";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test.describe("sign in", () => {
  test("email sign in reaches the profile and shows the identity", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder("Enter your email")).toBeVisible();

    await page.getByPlaceholder("Enter your email").fill("ada@example.com");
    await page.getByRole("button", { name: "Continue with email" }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByLabel("Email")).toHaveValue("ada@example.com");
    await expect(page.getByLabel("Email")).toBeDisabled();
  });

  test("the email never appears in the URL", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Enter your email").fill("private@example.com");
    await page.getByRole("button", { name: "Continue with email" }).click();
    await expect(page).toHaveURL(/\/profile$/);

    for (const entry of page.context().pages().map((p) => p.url())) {
      expect(entry).not.toContain("private@example.com");
      expect(entry).not.toContain("private%40example.com");
    }
  });

  test("google sign in reaches the profile", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByLabel("Email")).toHaveValue("googleuser@gmail.com");
  });

  test("the session cookie is httpOnly and unreadable from scripts", async ({ page, context }) => {
    await page.goto("/");
    await page.getByPlaceholder("Enter your email").fill("cookie@example.com");
    await page.getByRole("button", { name: "Continue with email" }).click();
    await expect(page).toHaveURL(/\/profile$/);

    const session = (await context.cookies()).find((c) => c.name.endsWith("mem_session"));
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("mem_session");
  });

  test("no secret reaches the browser", async ({ page }) => {
    const bodies: string[] = [];
    page.on("response", async (res) => {
      if (res.request().resourceType() === "document" || res.url().includes("/_next/static/")) {
        bodies.push(await res.text().catch(() => ""));
      }
    });

    await page.goto("/");
    await page.getByPlaceholder("Enter your email").fill("secret@example.com");
    await page.getByRole("button", { name: "Continue with email" }).click();
    await expect(page).toHaveURL(/\/profile$/);

    const all = bodies.join("\n");
    expect(all).not.toContain("e2e-secret-value-not-a-real-credential");
    expect(all).not.toContain("e2e-session-secret");
    expect(all).not.toContain("access_token");
  });
});

test.describe("profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("Enter your email").fill("profile@example.com");
    await page.getByRole("button", { name: "Continue with email" }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("the name saves and survives a reload", async ({ page }) => {
    await page.getByLabel("Name").fill("Ada Lovelace");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText("Saved");

    await page.reload();
    await expect(page.getByLabel("Name")).toHaveValue("Ada Lovelace");
  });

  test("a photo uploads, renders, and can be removed", async ({ page }) => {
    await page.setInputFiles('input[type="file"]', {
      name: "avatar.png",
      mimeType: "image/png",
      buffer: PNG,
    });

    await expect(page.getByRole("button", { name: "Remove photo" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByAltText("Your profile photo")).toBeVisible();

    await page.reload();
    await expect(page.getByAltText("Your profile photo")).toBeVisible();

    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByRole("button", { name: "Upload a profile photo" })).toBeVisible();
  });

  test("a file that is not an image is refused", async ({ page }) => {
    await page.setInputFiles('input[type="file"]', {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("this is not an image"),
    });
    await expect(page.locator('p[role="alert"]')).toContainText("JPEG, PNG or WebP");
  });

  test("signing out ends the session", async ({ page }) => {
    await page.getByRole("link", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByPlaceholder("Enter your email")).toBeVisible();

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("silent single sign-on", () => {
  test("a visitor with a provider session is signed in without clicking", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/");
    await page.getByPlaceholder("Enter your email").fill("sso@example.com");
    await page.getByRole("button", { name: "Continue with email" }).click();
    await expect(page).toHaveURL(/\/profile$/);

    // Drop everything this app issued, keep the provider's own session.
    const keep = (await context.cookies()).filter((c) => !c.name.includes("mem_"));
    await context.clearCookies();
    await context.addCookies(keep);

    await page.goto("/");
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByLabel("Email")).toHaveValue("sso@example.com");
    await context.close();
  });

  test("a visitor with no provider session sees the form, with no error", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/");
    await expect(page.getByPlaceholder("Enter your email")).toBeVisible();
    await expect(page.locator('p[role="alert"]')).toHaveCount(0);
    await context.close();
  });
});
