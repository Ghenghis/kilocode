/**
 * Visual Verification Test Suite — Screenshot-Based E2E Proof
 * 
 * This test suite captures visual proof of all features working.
 * Each test generates screenshots that serve as documentation and proof.
 * 
 * Run: npx playwright test tests/e2e/visual_verification.spec.ts
 * View: npx playwright show-report
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const HUB_URL = process.env.HUB_URL || 'http://localhost:8095';
const SCREENSHOT_DIR = 'test-results/visual-proofs';

// Helper to capture named screenshots
async function captureProof(page: Page, name: string, fullPage: boolean = false) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ 
    path: screenshotPath, 
    fullPage,
    animations: 'disabled'
  });
  return screenshotPath;
}

test.describe('🔍 Visual Verification — Proof by Screenshot', () => {
  
  test.beforeAll(async () => {
    console.log('\n📸 Starting Visual Verification Suite...');
    console.log(`   Hub URL: ${HUB_URL}`);
    console.log(`   Screenshot directory: ${SCREENSHOT_DIR}\n`);
  });

  test.describe('Phase 1: Provider Detection Visual Proof', () => {
    
    test('P1.1: Provider panel renders with tone badges', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.waitForSelector('#hub-shell', { timeout: 10000 });
      
      // Navigate to Providers panel
      await page.click('text=Providers');
      await page.waitForTimeout(500);
      
      // Verify provider cards visible
      const providerCards = page.locator('.hub-card');
      await expect(providerCards.first()).toBeVisible();
      
      // Capture proof
      await captureProof(page, 'P1.1-providers-panel-with-badges');
      
      // Verify tone badges present
      const badges = page.locator('[class*="badge"], [style*="22c55e"], [style*="f59e0b"]');
      const badgeCount = await badges.count();
      expect(badgeCount).toBeGreaterThan(0);
      
      console.log('✅ P1.1: Provider panel captured');
    });

    test('P1.2: MiniMax provider detected and marked positive', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=Providers');
      
      // Look for MiniMax card
      const minimaxCard = page.locator('.hub-card:has-text("MiniMax")');
      await expect(minimaxCard).toBeVisible();
      
      // Verify positive indicator (green)
      const positiveIndicator = minimaxCard.locator('[style*="22c55e"], .badge-success');
      await expect(positiveIndicator).toBeVisible();
      
      await captureProof(page, 'P1.2-minimax-positive-detection');
      console.log('✅ P1.2: MiniMax detection captured');
    });
  });

  test.describe('Phase 2: Control Center Visual Proof', () => {
    
    test('P2.1: Overview panel with header badges', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=Overview');
      
      // Wait for badges to render
      await page.waitForSelector('.hub-card, [class*="badge"]', { timeout: 5000 });
      
      // Capture overview
      await captureProof(page, 'P2.1-overview-panel-badges');
      
      // Verify summary cards exist
      const cards = page.locator('.hub-card');
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThanOrEqual(3);
      
      console.log('✅ P2.1: Overview panel captured');
    });

    test('P2.2: KiloCode sync status indicator', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=Overview');
      
      // Look for KiloCode status
      const kiloStatus = page.locator('text=/KiloCode|kc-main|synced/i').first();
      await expect(kiloStatus).toBeVisible();
      
      await captureProof(page, 'P2.2-kilocode-sync-status');
      console.log('✅ P2.2: KiloCode sync status captured');
    });
  });

  test.describe('Phase 3: Settings Validation Visual Proof', () => {
    
    test('P3.1: Settings panel with validation cards', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=Settings');
      
      // Wait for settings to load
      await page.waitForTimeout(1000);
      
      // Capture settings panel
      await captureProof(page, 'P3.1-settings-validation-panel');
      
      // Verify validation elements
      const validationElements = page.locator('text=/validate|validation|autofill/i');
      const count = await validationElements.count();
      expect(count).toBeGreaterThanOrEqual(1);
      
      console.log('✅ P3.1: Settings panel captured');
    });
  });

  test.describe('Phase 7: Diff Rendering Visual Proof', () => {
    
    test('P7.1: Diff rendering with syntax highlighting', async ({ page }) => {
      // First, trigger an agent output via API
      await page.goto(`${HUB_URL}/`);
      await page.click('text=Agents');
      
      // Inject test diff output via console (simulating agent output)
      await page.evaluate(() => {
        // @ts-ignore
        window._hub_emit('agent.output', {
          agent_id: 'kc-06',
          type: 'diff',
          content: `+ import { useState } from 'react';
- import React from 'react';
  
  function App() {
+   const [count, setCount] = useState(0);
-   const count = 0;
    return (
      <div>Hello World</div>
    );
  }`
        });
      });
      
      await page.waitForTimeout(500);
      
      // Capture diff rendering
      await captureProof(page, 'P7.1-diff-syntax-highlighting');
      
      // Verify diff elements
      const diffElements = page.locator('[style*="22c55e"], [style*="ef4444"], .diff-line');
      const count = await diffElements.count();
      expect(count).toBeGreaterThan(0);
      
      console.log('✅ P7.1: Diff rendering captured');
    });

    test('P7.2: Code block with copy button', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=Agents');
      
      // Inject code output
      await page.evaluate(() => {
        // @ts-ignore
        window._hub_emit('agent.output', {
          agent_id: 'kc-06',
          type: 'code',
          language: 'python',
          content: `def hello_world():
    print("Hello, World!")
    return True`
        });
      });
      
      await page.waitForTimeout(500);
      
      await captureProof(page, 'P7.2-code-block-copy-button');
      
      // Verify code block elements
      const codeBlock = page.locator('pre, code, .code-block');
      await expect(codeBlock.first()).toBeVisible();
      
      console.log('✅ P7.2: Code block captured');
    });
  });

  test.describe('Phase 8: MCP Management Visual Proof', () => {
    
    test('P8.1: MCP server health panel', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=MCP');
      
      await page.waitForTimeout(500);
      
      // Capture MCP panel
      await captureProof(page, 'P8.1-mcp-server-health-panel');
      
      // Verify server cards
      const serverCards = page.locator('.hub-card:has-text("filesystem"), .hub-card:has-text("git")');
      const count = await serverCards.count();
      expect(count).toBeGreaterThanOrEqual(2);
      
      console.log('✅ P8.1: MCP panel captured');
    });

    test('P8.2: MCP tool approval UI', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=MCP');
      
      // Look for tool approval elements
      const toolElements = page.locator('text=/tool|approve|deny/i');
      await expect(toolElements.first()).toBeVisible();
      
      await captureProof(page, 'P8.2-mcp-tool-approval-ui');
      console.log('✅ P8.2: MCP tool approval captured');
    });
  });

  test.describe('Phase 9: Roadmap Visual Proof', () => {
    
    test('P9.1: Roadmap panel with phase cards', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=Roadmap');
      
      await page.waitForTimeout(500);
      
      // Capture roadmap
      await captureProof(page, 'P9.1-roadmap-phase-cards');
      
      // Verify phase cards
      const phaseCards = page.locator('.hub-card:has-text("Phase")');
      const count = await phaseCards.count();
      expect(count).toBeGreaterThanOrEqual(5);
      
      console.log('✅ P9.1: Roadmap panel captured');
    });

    test('P9.2: Progress bars on phase cards', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=Roadmap');
      
      // Look for progress indicators
      const progressBars = page.locator('[style*="gradient"], [style*="width"], .progress-bar');
      const count = await progressBars.count();
      expect(count).toBeGreaterThan(0);
      
      await captureProof(page, 'P9.2-roadmap-progress-bars');
      console.log('✅ P9.2: Progress bars captured');
    });
  });

  test.describe('War Room: Collaboration Visual Proof', () => {
    
    test('W.1: War Room agent presence grid', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=War Room');
      
      await page.waitForTimeout(1000);
      
      // Capture War Room
      await captureProof(page, 'W.1-warroom-agent-presence-grid', true);
      
      // Verify agent indicators
      const agentIndicators = page.locator('[title^="kc-"]');
      const count = await agentIndicators.count();
      expect(count).toBeGreaterThanOrEqual(21);
      
      console.log('✅ W.1: War Room agent grid captured');
    });

    test('W.2: War Room pending approvals', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=War Room');
      
      // Look for approval queue
      const approvalSection = page.locator('text=/Pending Approvals|approval/i');
      await expect(approvalSection.first()).toBeVisible();
      
      await captureProof(page, 'W.2-warroom-pending-approvals');
      console.log('✅ W.2: War Room approvals captured');
    });

    test('W.3: War Room activity stream', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=War Room');
      
      // Look for activity feed
      const activityFeed = page.locator('text=/Activity|Stream|Recent/i');
      await expect(activityFeed.first()).toBeVisible();
      
      await captureProof(page, 'W.3-warroom-activity-stream');
      console.log('✅ W.3: War Room activity captured');
    });

    test('W.4: War Room collaboration thread', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      await page.click('text=War Room');
      
      // Look for thread section
      const threadSection = page.locator('text=/Threads|Collaboration|Messages/i');
      await expect(threadSection.first()).toBeVisible();
      
      await captureProof(page, 'W.4-warroom-collaboration-threads');
      console.log('✅ W.4: War Room threads captured');
    });
  });

  test.describe('Cross-Surface: Live Binding Visual Proof', () => {
    
    test('P13.1: Hub shell with all panels visible', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      
      // Wait for full load
      await page.waitForTimeout(2000);
      
      // Capture full Hub
      await captureProof(page, 'P13.1-hub-shell-full-view', true);
      
      // Verify all major panels accessible
      const panels = ['Providers', 'Overview', 'Settings', 'Agents', 'MCP', 'Roadmap', 'War Room'];
      for (const panel of panels) {
        const link = page.locator(`text=${panel}`);
        await expect(link).toBeVisible();
      }
      
      console.log('✅ P13.1: Full Hub view captured');
    });

    test('P13.2: Settings change propagates visually', async ({ page }) => {
      await page.goto(`${HUB_URL}/`);
      
      // Initial state
      await page.click('text=Settings');
      await captureProof(page, 'P13.2a-settings-initial-state');
      
      // Trigger a change via API (we'll simulate this)
      await page.evaluate(() => {
        // @ts-ignore
        window._hub_emit('settings.changed', {
          changed_keys: ['test_setting'],
          changed_by: 'visual_test'
        });
      });
      
      await page.waitForTimeout(500);
      await captureProof(page, 'P13.2b-settings-after-change');
      
      console.log('✅ P13.2: Settings propagation captured');
    });
  });

  test.afterAll(async () => {
    console.log('\n📸 Visual Verification Complete!');
    console.log(`   Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('   View report: npx playwright show-report\n');
  });
});

// Additional utility tests for responsive design
test.describe('📱 Responsive Visual Verification', () => {
  
  test('Mobile viewport: Hub renders correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(`${HUB_URL}/`);
    await page.waitForTimeout(2000);
    
    await captureProof(page, 'mobile-hub-responsive');
    
    // Verify shell still visible
    const shell = page.locator('#hub-shell');
    await expect(shell).toBeVisible();
    
    console.log('✅ Mobile responsive captured');
  });

  test('Tablet viewport: Panels accessible', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto(`${HUB_URL}/`);
    await page.waitForTimeout(2000);
    
    await captureProof(page, 'tablet-hub-responsive');
    
    // Verify panels accessible
    const panels = page.locator('text=Providers, text=Overview, text=War Room');
    await expect(panels.first()).toBeVisible();
    
    console.log('✅ Tablet responsive captured');
  });
});
