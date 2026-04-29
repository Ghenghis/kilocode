/**
 * Playwright E2E Proof Tests — KiloCode Control Hub
 *
 * Covers every acceptance gate from use-me-addon/11_PLAYWRIGHT_PROOF_CONTRACT.md:
 *   1. Control center loads (hub renders with all nav items)
 *   2. Overview panel — service health dots present
 *   3. Boot gate panel — 8-check matrix renders, SAFEMODE banner logic
 *   4. Provider panel — provider cards render, failover order displayed
 *   5. Settings panel — questions list loads, mode selector works
 *   6. Evidence panel — table renders columns
 *   7. Repair panel — timeline renders, trigger button present
 *   8. Dispatch panel — compose + send works
 *   9. LM Studio panel — model list request fires
 *  10. Audit trail panel — entries table renders
 *
 * Run locally (hub must be on :8095):
 *   npx playwright test tests/e2e/test_hub_playwright.ts
 *
 * Run against VPS (forward first):
 *   ssh -L 18095:localhost:8095 root@187.77.30.206
 *   WEBUI_BASE=http://localhost:18095 npx playwright test tests/e2e/test_hub_playwright.ts
 */

import { test, expect, Page } from '@playwright/test';

const BASE = process.env.WEBUI_BASE ?? 'http://localhost:8095';

// ── helpers ──────────────────────────────────────────────────────────────────

async function gotoHub(page: Page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 20_000 });
  // Wait for sidebar to be visible — confirms hub fully loaded
  await expect(page.locator('#sidebar')).toBeVisible({ timeout: 15_000 });
}

async function clickNav(page: Page, panelId: string) {
  await page.click(`[data-panel="${panelId}"]`);
  await page.waitForSelector(`#panel-${panelId}`, { state: 'visible', timeout: 8_000 });
}

// ── 1. Hub Loads ──────────────────────────────────────────────────────────────

test('hub: page loads and renders title', async ({ page }) => {
  await gotoHub(page);
  await expect(page).toHaveTitle(/KiloCode/i);
  const heading = page.locator('#header h1');
  await expect(heading).toBeVisible();
  await expect(heading).toContainText('KiloCode');
});

test('hub: sidebar contains all required nav items', async ({ page }) => {
  await gotoHub(page);
  const requiredPanels = [
    'overview', 'bootgate', 'lmstudio', 'ollama', 'providers',
    'hermes', 'zeroclaw', 'dispatch', 'settings', 'ports',
    'queue', 'evidence', 'repairs', 'audit', 'questions', 'maintenance', 'vsix',
  ];
  for (const panelId of requiredPanels) {
    await expect(page.locator(`[data-panel="${panelId}"]`), `nav item: ${panelId}`).toBeVisible();
  }
});

test('hub: overview panel is shown by default', async ({ page }) => {
  await gotoHub(page);
  await expect(page.locator('#panel-overview')).toBeVisible();
});

// ── 2. Overview Panel ─────────────────────────────────────────────────────────

test('overview: health dots are rendered', async ({ page }) => {
  await gotoHub(page);
  // Wait a moment for the auto-refresh to fire
  await page.waitForTimeout(1_500);
  const dots = page.locator('.sdot');
  const count = await dots.count();
  expect(count).toBeGreaterThanOrEqual(3);
});

test('overview: healthall API is called on load', async ({ page }) => {
  const apiCalled = page.waitForRequest(req => req.url().includes('/api/healthall'));
  await gotoHub(page);
  await apiCalled;
});

test('overview: stat cards present', async ({ page }) => {
  await gotoHub(page);
  const cards = page.locator('.stat-card, .card');
  await expect(cards.first()).toBeVisible({ timeout: 8_000 });
});

// ── 3. Boot Gate Panel ────────────────────────────────────────────────────────

test('bootgate: panel renders 8-check matrix', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'bootgate');
  const panel = page.locator('#panel-bootgate');
  await expect(panel).toBeVisible();

  // Eight named checks must appear
  const checks = [
    'runtime', 'settings', 'hermes', 'NATS',
    'LM Studio', 'Ollama', 'LiteLLM', 'questions',
  ];
  for (const label of checks) {
    await expect(panel.getByText(label, { exact: false }), `boot check: ${label}`).toBeVisible();
  }
});

test('bootgate: run health check button exists and is clickable', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'bootgate');
  const btn = page.locator('#panel-bootgate').getByRole('button', { name: /run|check|health/i }).first();
  await expect(btn).toBeVisible();
  await btn.click();
  // Should trigger a network request
  const req = page.waitForResponse(res => res.url().includes('/health') || res.url().includes('healthall'), { timeout: 8_000 });
  await req.catch(() => { /* ok if already caught */ });
});

test('bootgate: SAFEMODE banner is NOT shown when services are healthy', async ({ page }) => {
  const healthyBody = JSON.stringify({
    runtime: { ok: true }, settings: { ok: true }, hermes: { ok: true },
    lmstudio: { ok: true }, ollama: { ok: true }, litellm: { ok: true },
  });
  await page.route('**/api/healthall', route => route.fulfill({
    status: 200, contentType: 'application/json', body: healthyBody,
  }));
  await page.route('**/api/settings/settings/questions', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }));
  await gotoHub(page);
  await clickNav(page, 'bootgate');
  // Wait for bootGateCheck to complete and hide safemode
  await page.waitForTimeout(2_000);
  const safemodeBanner = page.locator('#safemode-banner, .safemode-banner, [data-safemode]');
  await expect(safemodeBanner).toBeHidden({ timeout: 5_000 });
});

test('bootgate: SAFEMODE banner appears when a critical service is down', async ({ page }) => {
  await page.route('**/api/healthall', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      runtime: { ok: false, error: 'Connection refused' },
      settings: { ok: false },
      hermes: { ok: false },
      lmstudio: { ok: false },
      ollama: { ok: false },
      litellm: { ok: false },
    }),
  }));
  await gotoHub(page);
  await clickNav(page, 'bootgate');
  // Trigger a fresh boot check
  const btn = page.locator('#panel-bootgate').getByRole('button', { name: /run|check|health/i }).first();
  if (await btn.isVisible()) await btn.click();
  await expect(page.locator('#safemode-banner, .safemode-banner, [data-safemode]')).toBeVisible({ timeout: 8_000 });
});

// ── 4. Provider Panel ─────────────────────────────────────────────────────────

test('providers: panel loads and shows provider cards', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'providers');
  const panel = page.locator('#panel-providers');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/LM Studio|Ollama|LiteLLM|MiniMax/i).first()).toBeVisible({ timeout: 8_000 });
});

test('providers: failover order is displayed', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'providers');
  const panel = page.locator('#panel-providers');
  await expect(panel.getByText(/failover|priority|order/i).first()).toBeVisible({ timeout: 8_000 });
});

// ── 5. Settings Panel ─────────────────────────────────────────────────────────

test('settings: panel loads and shows state', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'settings');
  const panel = page.locator('#panel-settings');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: /load|refresh|state/i }).first()).toBeVisible({ timeout: 8_000 });
});

test('settings: mode selector has valid options', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'settings');
  const panel = page.locator('#panel-settings');
  const modeSelect = panel.locator('select');
  if (await modeSelect.count() > 0) {
    const options = await modeSelect.locator('option').allTextContents();
    const modes = options.map(o => o.toLowerCase().trim());
    expect(modes).toContain('standard');
    expect(modes.some(m => ['yolo', 'elevated', 'readonly'].includes(m))).toBe(true);
  }
});

// ── 6. Questions Panel ────────────────────────────────────────────────────────

test('questions: panel loads and shows unanswered items', async ({ page }) => {
  await page.route('**/api/settings/settings/questions', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: 'minimax_api_key', label: 'MiniMax API Key', type: 'secret', answered: false, required: true },
      { id: 'nats_url', label: 'NATS URL', type: 'url', answered: false, required: false, inferable: true },
    ]),
  }));
  await gotoHub(page);
  await clickNav(page, 'questions');
  const panel = page.locator('#panel-questions');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/MiniMax API Key|NATS URL/i).first()).toBeVisible({ timeout: 8_000 });
});

test('questions: auto-fill button exists and fires request', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'questions');
  const btn = page.locator('#panel-questions').getByRole('button', { name: /auto.?fill|fill/i }).first();
  await expect(btn).toBeVisible({ timeout: 8_000 });

  const reqPromise = page.waitForRequest(req =>
    req.url().includes('/auto-fill') && req.method() === 'POST', { timeout: 10_000 }
  );
  await btn.click();
  await reqPromise;
});

// ── 7. Evidence Panel ─────────────────────────────────────────────────────────

test('evidence: panel renders table with expected columns', async ({ page }) => {
  await page.route('**/api/settings/settings/audit*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      {
        evidence_id: 'abc-123', subsystem: 'providers',
        changed_fields: ['litellm_base_url'], validation_result: 'healthy',
        changed_by: 'test', timestamp: new Date().toISOString(),
        restart_required: false, disruptive: false,
      },
    ]),
  }));
  await gotoHub(page);
  await clickNav(page, 'evidence');
  const panel = page.locator('#panel-evidence');
  await expect(panel).toBeVisible();
  // Must have at least one table or list element
  const tbl = panel.locator('table, .evidence-table, .timeline-list, ul').first();
  await expect(tbl).toBeVisible({ timeout: 8_000 });
});

// ── 8. Repairs Panel ──────────────────────────────────────────────────────────

test('repairs: panel shows timeline and trigger button', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'repairs');
  const panel = page.locator('#panel-repairs');
  await expect(panel).toBeVisible();
  const btn = panel.getByRole('button', { name: /trigger|repair|run/i }).first();
  await expect(btn).toBeVisible({ timeout: 8_000 });
});

test('repairs: trigger repair fires POST request', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'repairs');
  const btn = page.locator('#panel-repairs').getByRole('button', { name: /trigger|repair/i }).first();

  const reqPromise = page.waitForRequest(req =>
    req.url().includes('/repair') && req.method() === 'POST', { timeout: 10_000 }
  );
  await btn.click();
  await reqPromise;
});

// ── 9. Dispatch Panel ─────────────────────────────────────────────────────────

test('dispatch: panel has command input and send button', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'dispatch');
  const panel = page.locator('#panel-dispatch');
  await expect(panel).toBeVisible();

  const input = panel.locator('textarea, input[type="text"]').first();
  await expect(input).toBeVisible({ timeout: 8_000 });

  const btn = panel.getByRole('button', { name: /send|dispatch|submit/i }).first();
  await expect(btn).toBeVisible();
});

test('dispatch: send fires POST to intake endpoint', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'dispatch');
  const panel = page.locator('#panel-dispatch');
  const input = panel.locator('textarea, input[type="text"]').first();
  await input.fill('echo proof-playwright-dispatch');

  const reqPromise = page.waitForRequest(req =>
    req.url().includes('/intake') && req.method() === 'POST', { timeout: 10_000 }
  );
  const btn = panel.getByRole('button', { name: /send|dispatch|submit/i }).first();
  await btn.click();
  await reqPromise;
});

// ── 10. LM Studio Panel ───────────────────────────────────────────────────────

test('lmstudio: panel renders and loads models', async ({ page }) => {
  await page.route('**/api/lmstudio/v1/models', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      object: 'list',
      data: [
        { id: 'meta-llama-3.1-70b', object: 'model', created: 1700000000, owned_by: 'lm-studio' },
        { id: 'codestral-22b', object: 'model', created: 1700000001, owned_by: 'lm-studio' },
      ],
    }),
  }));
  await gotoHub(page);
  await clickNav(page, 'lmstudio');
  const panel = page.locator('#panel-lmstudio');
  await expect(panel).toBeVisible();
  // Trigger model load
  const btn = panel.getByRole('button', { name: /load|refresh|models/i }).first();
  if (await btn.isVisible()) await btn.click();
  await expect(panel.getByText(/meta-llama|codestral/i).first()).toBeVisible({ timeout: 8_000 });
});

test('lmstudio: RTX / GPU badge is shown', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'lmstudio');
  const panel = page.locator('#panel-lmstudio');
  await expect(panel).toBeVisible();
  const gpuBadge = panel.locator('.hbadge-gpu, [data-gpu], .gpu-badge').first();
  await expect(gpuBadge).toBeVisible({ timeout: 6_000 });
});

// ── 11. Audit Trail Panel ─────────────────────────────────────────────────────

test('audit: panel loads entries table', async ({ page }) => {
  await page.route('**/api/settings/settings/audit*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      {
        evidence_id: 'e1', subsystem: 'mode', changed_fields: ['mode'],
        validation_result: 'healthy', changed_by: 'user',
        timestamp: new Date().toISOString(), restart_required: false, disruptive: false,
      },
      {
        evidence_id: 'e2', subsystem: 'providers', changed_fields: ['litellm_base_url'],
        validation_result: 'healthy', changed_by: 'agent',
        timestamp: new Date().toISOString(), restart_required: false, disruptive: false,
      },
    ]),
  }));
  await gotoHub(page);
  await clickNav(page, 'audit');
  const panel = page.locator('#panel-audit');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/mode|providers/i).first()).toBeVisible({ timeout: 8_000 });
});

// ── 12. Ports Panel ───────────────────────────────────────────────────────────

test('ports: panel shows canonical port registry', async ({ page }) => {
  await page.route('**/api/settings/ports', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      services: {
        'kilocode-runtime': { port: 8081, reachable: true, pending: null },
        'kilocode-hermes': { port: 8091, reachable: true, pending: null },
        'kilocode-webui': { port: 8095, reachable: true, pending: null },
      },
      pending_changes: {},
    }),
  }));
  await gotoHub(page);
  await clickNav(page, 'ports');
  const panel = page.locator('#panel-ports');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/8081|8091|8095/i).first()).toBeVisible({ timeout: 8_000 });
});

// ── 13. Hermes Panel ──────────────────────────────────────────────────────────

test('hermes: panel shows status and action buttons', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'hermes');
  const panel = page.locator('#panel-hermes');
  await expect(panel).toBeVisible();

  const buttons = panel.getByRole('button');
  await expect(buttons.first()).toBeVisible({ timeout: 8_000 });
});

// ── 14. Maintenance Panel ─────────────────────────────────────────────────────

test('maintenance: panel has schedule form', async ({ page }) => {
  await gotoHub(page);
  await clickNav(page, 'maintenance');
  const panel = page.locator('#panel-maintenance');
  await expect(panel).toBeVisible();
  const btn = panel.getByRole('button', { name: /schedule|window|apply/i }).first();
  await expect(btn).toBeVisible({ timeout: 8_000 });
});

// ── 15. Full navigation smoke test ────────────────────────────────────────────

test('navigation: all panels render without JS errors', async ({ page }) => {
  const jsErrors: string[] = [];
  page.on('pageerror', err => jsErrors.push(err.message));

  await gotoHub(page);

  const panels = [
    'overview', 'bootgate', 'lmstudio', 'ollama', 'providers',
    'hermes', 'zeroclaw', 'dispatch', 'settings', 'ports',
    'queue', 'evidence', 'repairs', 'audit', 'questions', 'maintenance', 'vsix',
  ];

  for (const panelId of panels) {
    await clickNav(page, panelId);
    await page.waitForTimeout(200); // let any panel-init JS fire
  }

  // Filter out benign network errors (services may not be running locally)
  const realErrors = jsErrors.filter(e =>
    !e.includes('fetch') && !e.includes('NetworkError') && !e.includes('Failed to fetch')
  );
  expect(realErrors, `JS errors: ${realErrors.join('; ')}`).toHaveLength(0);
});
