---
templateId: prfaq
templateName: "Working Backwards PR/FAQ"
templateVersion: "1.0.0"
templateDescription: "Amazon-style Working Backwards document: a fictional press release plus internal and external FAQs to validate a product idea before building."
templateCategory: product
templateRubric: prfaq-rubric-v1
author: "KiloCode Studio"
---

# {{PRODUCT_NAME}} — PR/FAQ

> **Working Backwards principle**: We write the press release first, in the
> voice of a customer who already loves the product, *before* we commit to
> building it. If we cannot tell a credible launch story, we cannot ship a
> credible product.
>
> **How to use this doc**: Fill the press release first. Then the External
> FAQ (the questions a journalist or new customer would ask). Then the
> Internal FAQ (the questions a sceptical reviewer at a 6-pager meeting
> would ask). Iterate until none of the FAQs require "we'll figure it out
> later."

---

## 1. Press release

> **Embargoed until**: <!-- ai-fill: target launch date, e.g. Q3 2026 -->
>
> **Headline (≤ 70 chars, customer-benefit framing, no jargon):**
>
> <!-- ai-fill: Lead with the customer outcome, not the technology. Example: "Now any small business can accept FedNow instant payments in five minutes." Bad: "Acme launches AI-powered B2B payments platform." -->
>
> **Sub-headline (1 sentence, who it's for + why now):**
>
> <!-- ai-fill: One sentence covering target persona, problem solved, and proof of timing. -->

**{{CITY, DATE}} —** <!-- ai-fill: Opening paragraph (~3 sentences). State what we are launching and the single most important customer benefit, with one specific number. Avoid the word "innovative". -->

<!-- ai-fill: Paragraph 2 (~3 sentences). Explain the problem the customer has today in concrete terms (a vignette, a workflow, a number) and how the new product solves it. -->

> "<!-- ai-fill: 1-2 sentence quote from a *real* would-be customer. If pre-launch, a beta participant. Use first names + role + company; never anonymous. -->" — {{CUSTOMER_NAME}}, {{TITLE}} at {{COMPANY}}

<!-- ai-fill: Paragraph 3 (~3 sentences). Describe how it works: the user's first 60 seconds. Three sentences max. -->

> "<!-- ai-fill: 1-2 sentence quote from the product/eng leader. Talks about the *engineering* unlock or the *behavior* shift, not the company's mission. -->" — {{LEADER_NAME}}, {{ROLE}}

<!-- ai-fill: Paragraph 4 (~2 sentences). Pricing, availability, and the call-to-action URL. Be specific: "Available today at example.com/start" not "coming soon". -->

**About {{COMPANY_NAME}}**: <!-- ai-fill: 2-sentence boilerplate. -->

---

## 2. External FAQ

> Questions a curious customer, journalist, or analyst would ask after
> reading the press release. Keep answers short — 2-4 sentences.

### What is {{PRODUCT_NAME}}?

<!-- ai-fill: One paragraph in plain English. Avoid restating the press release headline verbatim. -->

### Who is it for?

<!-- ai-fill: Name the persona, the team, and the company size. Then list 1-2 personas it is *not* for, and why. -->

### How is this different from {{TOP_COMPETITOR}}?

<!-- ai-fill: 3-bullet differentiation. Be honest about where the competitor is better today; explain the angle we win on. -->

### What does it cost?

<!-- ai-fill: Price tiers, what's included, what triggers an upgrade. -->

### What does it integrate with?

<!-- ai-fill: List 5-8 most important integrations. Star the launch-day ones. -->

### Is my data safe?

<!-- ai-fill: One paragraph: where data lives, who can access it, certifications planned/held (SOC 2, ISO 27001), and the user's deletion rights. -->

### When can I get it?

<!-- ai-fill: Specific date or rolling-availability schedule. If there is a waitlist, name the conversion criterion. -->

### How do I get help?

<!-- ai-fill: Support channels, response-time SLOs, status page URL. -->

---

## 3. Internal FAQ

> Questions a sceptical Director / VP would ask in a 6-pager review.
> Answer with intellectual honesty, not marketing.

### Why now? What changed in the world?

<!-- ai-fill: Three structural shifts (technology, behavior, regulation) that make this viable today and not in 2022. Each shift should cite a specific external data point. -->

### What is the size of the prize?

<!-- ai-fill: Bottom-up market sizing: # of target customers × ACV × reachable share. Show the math; resist top-down. -->

### What is the customer's WTP and what is the gross margin?

<!-- ai-fill: Willingness-to-pay evidence (interviews, LOIs, comp pricing) and unit-economics estimate. State the single biggest assumption that, if wrong, kills the model. -->

### What does success look like in 6 / 12 / 24 months?

| Horizon | North-Star metric | Threshold |
|---|---|---|
| 6 months | <!-- ai-fill --> | <!-- ai-fill --> |
| 12 months | <!-- ai-fill --> | <!-- ai-fill --> |
| 24 months | <!-- ai-fill --> | <!-- ai-fill --> |

### What are the top three risks?

<!-- ai-fill:
1. **Customer-adoption risk** — the assumption you must validate first.
2. **Technical risk** — the engineering unknown that could blow the timeline.
3. **Regulatory / partnership risk** — the external dependency outside our control.

For each, name (a) the specific test that retires the risk, (b) the cost of that test, (c) the call-it date. -->

### Why would we *not* build this?

<!-- ai-fill: Steel-man the case against. What would a thoughtful sceptic say? (Examples: cannibalises existing line, distribution-disadvantaged, GTM doesn't match team strength.) Then answer each. -->

### What teams need to be involved at launch?

<!-- ai-fill: Eng (services), Eng (clients), Design, PM, Legal, Compliance, Support, Sales, Marketing, Finance — flag the ones with critical-path dependencies. -->

### What is the deprecation path if it fails?

<!-- ai-fill: How we wind it down with minimal customer pain. Migration window, refund policy, data export. -->

### What does the second product look like?

<!-- ai-fill: If we win the wedge, what is product #2 — and what data / distribution / brand asset from product #1 makes it disproportionately easier? -->

---

## 4. Tenets (decision rules)

<!-- ai-fill: 3-5 tenets that guide trade-offs. Format: "We will X, even when Y, because Z." Examples:

- We will optimise for time-to-first-value over feature breadth, even when that means saying no to enterprise asks, because activation is the failure mode that kills B2B SaaS.
- We will keep PII inside the customer's region, even when that doubles infra cost, because regulated buyers will not sign without it.
- We will price by transaction volume, not seats, even when seats are easier to forecast, because seats reward smaller usage and we want adoption to expand. -->

---

## 5. Out of scope (V1)

<!-- ai-fill: Bulleted list of capabilities investors / customers will ask about that we are *deliberately deferring*. Each item: "X — deferred to <horizon>; rationale: <one sentence>." -->

---

## 6. Open questions

<!-- ai-fill: 5-10 questions we cannot yet answer. Each tagged with the owner and the call-it date. The reviewer should leave the meeting knowing exactly what we don't know. -->

---

> **Editor's note**: A good PR/FAQ is honest about what is unknown. If the
> Internal FAQ has fewer than three uncomfortable questions, the document
> is not done.

---

## Worked example — fragment of a real-shaped headline

To anchor the shape, a few example headlines that pass the press-release
sniff test (and the *anti*-pattern they replaced):

> **Good**: "Now any small business can accept FedNow instant payments in five minutes."
> **Bad**: "Acme Corp launches innovative AI-powered fintech platform."

> **Good**: "Hospital nurses can now reorder PPE stock with one tap from any cart."
> **Bad**: "We are excited to announce the next generation of supply-chain software."

> **Good**: "Independent musicians keep 95% of streaming revenue with no upfront fees."
> **Bad**: "Our new platform empowers creators with cutting-edge tools."

The pattern: the good headline names *who* benefits, what they can now
*do*, and how that breaks from the status quo. The bad headline names
*us* and signals adjectives.

## Style notes (delete before sending)

### Voice

- The press release is written in *the voice of someone who already loves
  the product*. Past-tense announcement, future-tense commitment.
- The External FAQ is written for a curious *outsider*. Plain English.
- The Internal FAQ is written for a *sceptical reviewer*. Numbers,
  honesty, no hand-waving.

### Length

- Press release: 4 paragraphs, under 300 words. If you need more, the
  benefit isn't crisp yet.
- External FAQ: 2-4 sentences per answer.
- Internal FAQ: paragraphs are fine; the discipline is being honest, not
  being concise.
- Tenets: 3-5 max. Ten tenets is no tenets.

### Common failure modes

- **Reading like a press release we'd never run**: hedged language, vague
  benefits, no real customer quote. Fix by writing the customer email
  *first* and reverse-engineering the headline from that.
- **Internal FAQ is a marketing FAQ**: every answer is a positive spin.
  Replace at least three with the unflinching numbers a Director would
  ask for in review.
- **Out-of-scope omitted**: pretending V1 will do everything. Be
  explicit; the reviewer will catch it anyway.
- **Tenets that nobody could disagree with**: "We will be customer-
  obsessed" is not a tenet. A tenet must imply a *trade-off* you would
  defend.

## Reviewer rubric (cut before sending)

- [ ] Press-release headline is in customer-benefit framing, under 70 chars.
- [ ] At least one named-customer quote, and at least one named-leader quote.
- [ ] External FAQ has 6-10 answers, each 2-4 sentences.
- [ ] Internal FAQ contains at least three uncomfortable questions
      with honest answers.
- [ ] Tenets imply trade-offs (use the "even when … because …" template).
- [ ] Out-of-scope list names the deferrals investors will assume are in.
- [ ] Open questions list names owners and call-it dates.
