/**
 * Multi-step checkout — Playwright spec (Anchor 3 example).
 *
 * Demonstrates explicit `tracing.start({ screenshots, snapshots, sources })`
 * to capture deterministic evidence even on green runs. The resulting
 * `trace.zip` is uploaded as a CI artifact for non-coder review.
 */

import { test, expect } from "@playwright/test"

test.describe("Checkout flow", () => {
	test.beforeEach(async ({ context }) => {
		await context.tracing.start({
			screenshots: true,
			snapshots: true,
			sources: true,
		})
	})

	test.afterEach(async ({ context }, testInfo) => {
		const path = testInfo.outputPath("trace.zip")
		await context.tracing.stop({ path })
		await testInfo.attach("trace", { path, contentType: "application/zip" })
	})

	test("completes a 3-step checkout (cart -> shipping -> payment)", async ({ page }) => {
		// Step 1 — add to cart from product page.
		await page.goto("/products/widget")
		await expect(page.getByRole("heading", { name: /widget/i })).toBeVisible()
		await page.getByRole("button", { name: /add to cart/i }).click()
		await expect(page.getByRole("status")).toContainText(/added/i)

		// Step 2 — enter shipping address.
		await page.goto("/checkout/shipping")
		await page.getByLabel(/full name/i).fill("Ada Lovelace")
		await page.getByLabel(/address/i).fill("1 Computing Lane")
		await page.getByLabel(/city/i).fill("London")
		await page.getByLabel(/postal code/i).fill("EC1A 1BB")
		await page.getByRole("button", { name: /continue to payment/i }).click()
		await expect(page).toHaveURL(/\/checkout\/payment/)

		// Step 3 — enter payment details and confirm.
		await page.getByLabel(/card number/i).fill("4242 4242 4242 4242")
		await page.getByLabel(/expiry/i).fill("12/30")
		await page.getByLabel(/cvc/i).fill("123")
		await page.getByRole("button", { name: /place order/i }).click()
		await expect(page.getByRole("heading", { name: /order confirmed/i })).toBeVisible()
		await expect(page.getByText(/order number/i)).toBeVisible()
	})
})
