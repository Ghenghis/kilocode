/**
 * Signup flow — Cypress spec (Anchor 3 example).
 *
 * Cypress records video + screenshots; Test Replay (when enabled) captures
 * full DOM and network state for forensic non-coder review.
 */

/// <reference types="cypress" />

describe("Signup flow", () => {
	beforeEach(() => {
		cy.visit("/signup")
	})

	it("renders the signup form", () => {
		cy.contains("h1", /create your account/i).should("be.visible")
		cy.findByLabelText(/email/i).should("exist")
		cy.findByLabelText(/password/i).should("exist")
		cy.findByLabelText(/confirm password/i).should("exist")
	})

	it("rejects mismatched passwords", () => {
		cy.findByLabelText(/email/i).type("new-user@example.com")
		cy.findByLabelText(/^password/i).type("Sup3rSecret!")
		cy.findByLabelText(/confirm password/i).type("Different!")
		cy.findByRole("button", { name: /create account/i }).click()
		cy.findByRole("alert").should("contain.text", "match")
	})

	it("creates an account with valid input and redirects to onboarding", () => {
		const email = `user+${Date.now()}@example.com`
		cy.findByLabelText(/email/i).type(email)
		cy.findByLabelText(/^password/i).type("Sup3rSecret!")
		cy.findByLabelText(/confirm password/i).type("Sup3rSecret!")
		cy.findByRole("button", { name: /create account/i }).click()
		cy.url().should("match", /\/onboarding/)
		cy.contains(/welcome/i).should("be.visible")
	})
})
