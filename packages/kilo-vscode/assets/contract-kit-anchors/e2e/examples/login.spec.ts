/**
 * Login flow — Playwright spec (Anchor 3 example).
 *
 * Three assertions cover: form rendering, valid credentials, invalid
 * credentials. Failure traces include screenshots, DOM snapshots, network
 * calls and console output for non-coder review.
 */

import { test, expect } from "@playwright/test"

test.describe("Login flow", () => {
	test("renders the login form with email and password fields", async ({ page }) => {
		await page.goto("/login")
		await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible()
		await expect(page.getByLabel(/email/i)).toBeVisible()
		await expect(page.getByLabel(/password/i)).toBeVisible()
		// Visual regression baseline — Anchor 3 (proof.visual-regression).
		await expect(page).toHaveScreenshot("login-form.png")
	})

	test("logs in with valid credentials and lands on the dashboard", async ({ page }) => {
		await page.goto("/login")
		await page.getByLabel(/email/i).fill("user@example.com")
		await page.getByLabel(/password/i).fill("correct-horse-battery-staple")
		await page.getByRole("button", { name: /sign in/i }).click()
		await expect(page).toHaveURL(/\/dashboard/)
		await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible()
	})

	test("shows an error for invalid credentials", async ({ page }) => {
		await page.goto("/login")
		await page.getByLabel(/email/i).fill("user@example.com")
		await page.getByLabel(/password/i).fill("wrong-password")
		await page.getByRole("button", { name: /sign in/i }).click()
		await expect(page.getByRole("alert")).toContainText(/invalid/i)
		await expect(page).toHaveURL(/\/login/)
	})
})
