/**
 * EmptyState — non-coder onboarding for the Contract Kit Creator.
 *
 * Replaces the cold "no document open" state with a single, big, friendly
 * prompt: "Describe what you want to build". Below the textarea sit six
 * one-click example chips so the user can try the studio without having to
 * type from scratch (a known cold-start barrier in non-coder UX research).
 *
 * Click the "Get started" button → posts `contract:enhancePrompt` to kick
 * off the PromptEnhancer (Ambiguity Detector + Domain Injector). The studio
 * shell takes over from there.
 *
 * SolidJS rules: signals at top, `<For>` for the example list. No new deps.
 */

import { Component, createSignal, For } from "solid-js"
import { Button } from "@kilocode/kilo-ui/button"
import { useVSCode } from "../../../context/vscode"

// ── Example projects (rough, two-paragraph ideas) ───────────────────────

interface ExampleProject {
  id: string
  label: string
  shortDescription: string
  longIdea: string
}

const EXAMPLES: ExampleProject[] = [
  {
    id: "marketplace",
    label: "Marketplace",
    shortDescription: "Buyers, sellers, listings, payments",
    longIdea:
      "I want to build an online marketplace where small sellers can list vintage cameras, and buyers can browse, ask questions, and pay through the site. Sellers should be able to upload photos, set prices, and ship orders, and buyers should be able to leave reviews after a purchase.\n\nThe site needs a simple onboarding flow for sellers, a search page for buyers, a listing detail page with photos and shipping options, a checkout flow with card payments, and a basic dashboard so sellers can see what is selling. Trust and safety matter — fake listings should be filtered out, and buyers should be able to report problems.",
  },
  {
    id: "internal-tool",
    label: "Internal tool",
    shortDescription: "Dashboard, workflow, team-only",
    longIdea:
      "I want to build an internal tool that helps our customer-success team handle support tickets faster. Right now we use a shared inbox, and tickets get lost. The tool should pull tickets from the inbox, assign them to a team member, and let them track status — open, in progress, waiting on customer, closed.\n\nIt needs a dashboard showing each person's queue, a detail page with the full conversation, and a way to share canned responses across the team. Only logged-in team members can use it. We need an audit trail so a manager can see who changed what.",
  },
  {
    id: "mobile-app",
    label: "Mobile app",
    shortDescription: "iOS + Android, login, push",
    longIdea:
      "I want to build a mobile app for iOS and Android that helps people track water intake during the day. The user opens the app, sees how much they have drunk so far, and taps a button to log a glass of water. Daily goals are personal — the app suggests a target based on age and weight.\n\nThe app needs a sign-in flow, a home screen with the day's progress, a history view showing the last week, and gentle push notifications to nudge users to drink water. Data should sync across devices so a phone and a tablet show the same progress.",
  },
  {
    id: "ai-assistant",
    label: "AI assistant",
    shortDescription: "Chat, retrieval, guardrails",
    longIdea:
      "I want to build an AI assistant that helps employees find answers in our company handbook. The user types a question in plain English, and the assistant replies with a short answer plus links to the source pages. The assistant should never invent answers — if the handbook does not cover the question, it should say so.\n\nThe assistant needs a chat-style interface, a pipeline that pulls fresh content from the handbook every night, and guardrails so it cannot leak salaries or other private documents. It should remember the last few questions in the conversation but not store them long-term unless the user opts in.",
  },
  {
    id: "ecommerce",
    label: "E-commerce store",
    shortDescription: "Catalog, cart, checkout, orders",
    longIdea:
      "I want to build an e-commerce store for a single brand that sells handmade ceramics. Visitors browse a small catalog, add pieces to a cart, and check out with a credit card. Each product has photos, a description, dimensions, and stock level. Once stock hits zero the product becomes unavailable but stays visible.\n\nThe store also needs a simple admin area for the owner to add products, mark orders as shipped, and view sales totals. Customers receive an order confirmation email and a shipping update. Tax and shipping are calculated at checkout based on the buyer's country.",
  },
  {
    id: "personal-blog",
    label: "Personal blog",
    shortDescription: "Posts, comments, subscribe",
    longIdea:
      "I want to build a personal blog where I write long-form posts about woodworking. Readers can browse posts by date or topic, read a full article, and leave a comment. I want a quiet, readable design — no ads, no popups, fast on mobile.\n\nI also want a way for readers to subscribe by email, so when I publish a new post they get a copy in their inbox. I write the posts in markdown and publish from a folder in my repo, so the site needs to rebuild whenever I push new content. Comments should be moderated to keep the spam out.",
  },
]

// ── Component ────────────────────────────────────────────────────────────

const EmptyState: Component = () => {
  const vscode = useVSCode()
  const post = (m: Record<string, unknown>) => vscode.postMessage(m as never)

  const [idea, setIdea] = createSignal<string>("")
  const [submitting, setSubmitting] = createSignal(false)

  const onChip = (ex: ExampleProject) => {
    setIdea(ex.longIdea)
  }

  const onSubmit = (e: Event) => {
    e.preventDefault()
    const text = idea().trim()
    if (!text) return
    setSubmitting(true)
    post({ type: "contract:enhancePrompt", rawIdea: text })
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        height: "100%",
        padding: "24px",
        overflow: "auto",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          width: "100%",
          "max-width": "640px",
          display: "flex",
          "flex-direction": "column",
          gap: "16px",
        }}
      >
        <div>
          <h2
            style={{
              "font-size": "20px",
              "font-weight": 600,
              margin: 0,
              "margin-bottom": "6px",
              color: "var(--vscode-foreground)",
            }}
          >
            Describe what you want to build
          </h2>
          <p
            style={{
              margin: 0,
              "font-size": "13px",
              color: "var(--vscode-descriptionForeground)",
            }}
          >
            Plain English is fine. The studio will ask three follow-up questions, then turn your
            idea into a contract you can hand to an AI agent.
          </p>
        </div>

        <textarea
          value={idea()}
          onInput={(e) => setIdea(e.currentTarget.value)}
          rows={8}
          placeholder="Example: I want to build a marketplace where people buy and sell vintage cameras…"
          spellcheck={true}
          aria-label="Describe what you want to build"
          style={{
            width: "100%",
            padding: "12px",
            "font-size": "14px",
            "line-height": 1.5,
            background: "var(--vscode-input-background)",
            color: "var(--vscode-input-foreground)",
            border: "1px solid var(--vscode-input-border)",
            "border-radius": "6px",
            resize: "vertical",
            "font-family": "var(--vscode-font-family)",
          }}
        />

        <div>
          <div
            style={{
              "font-size": "12px",
              "font-weight": 500,
              color: "var(--vscode-descriptionForeground)",
              "margin-bottom": "6px",
            }}
          >
            Don't know where to start? Try one of these example projects:
          </div>
          <div style={{ display: "flex", "flex-wrap": "wrap", gap: "6px" }}>
            <For each={EXAMPLES}>
              {(ex) => (
                <button
                  type="button"
                  onClick={() => onChip(ex)}
                  title={ex.shortDescription}
                  style={{
                    padding: "6px 10px",
                    "border-radius": "999px",
                    border: "1px solid var(--vscode-button-border, var(--vscode-input-border))",
                    background: "var(--vscode-button-secondaryBackground, var(--vscode-input-background))",
                    color: "var(--vscode-button-secondaryForeground, var(--vscode-foreground))",
                    "font-size": "12px",
                    cursor: "pointer",
                  }}
                >
                  {ex.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Button variant="primary" type="submit" disabled={!idea().trim() || submitting()}>
            {submitting() ? "Getting started…" : "Get started"}
          </Button>
          <span
            style={{
              "font-size": "12px",
              color: "var(--vscode-descriptionForeground)",
            }}
          >
            We never share your idea outside this workspace.
          </span>
        </div>
      </form>
    </div>
  )
}

export default EmptyState
