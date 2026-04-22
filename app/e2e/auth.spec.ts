import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero content and navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");

    // Nav links present
    await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /get started/i }).first(),
    ).toBeVisible();

    // Has a heading
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("navigates to /login via nav link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /log in/i }).click();
    await expect(page).toHaveURL("/login");
  });

  test("navigates to /signup via Get Started link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /get started/i }).first().click();
    await expect(page).toHaveURL("/signup");
  });
});

test.describe("Login page", () => {
  test("renders email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("notauser@example.com");
    await page.locator('input[name="password"]').fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Expect an error message to appear
    await expect(page.locator("p.text-danger, [role=alert]")).toBeVisible({
      timeout: 10000,
    });
  });

  test("has link to signup page", async ({ page }) => {
    await page.goto("/login");
    const signupLink = page.getByRole("link", { name: /create one|sign up/i });
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await expect(page).toHaveURL("/signup");
  });
});

test.describe("Signup page", () => {
  test("renders name, email, and password fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator('input[name="displayName"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account|sign up/i }),
    ).toBeVisible();
  });

  test("has link back to login", async ({ page }) => {
    await page.goto("/signup");
    const loginLink = page.getByRole("link", { name: /log in/i });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL("/login");
  });

  test("shows error for short password", async ({ page }) => {
    await page.goto("/signup");
    await page.locator('input[name="displayName"]').fill("Test User");
    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="password"]').fill("short");
    await page.getByRole("button", { name: /create account|sign up/i }).click();
    await expect(page.locator("p.text-danger, [role=alert]")).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Protected route redirect", () => {
  test("unauthenticated visit to /dashboard redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated visit to /resumes redirects to /login", async ({
    page,
  }) => {
    await page.goto("/resumes");
    await expect(page).toHaveURL(/\/login/);
  });
});
