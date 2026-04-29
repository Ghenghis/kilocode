import { test, expect } from '@playwright/test';
import { execFileSync, execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * KiloCode 21-Agent E2E Test Suite
 *
 * Tests all 21 agents (kc-main + kc-01…kc-20) through the Open WebUI
 * pipeline on hermes.daveai.tech (VPS 187.77.30.206).
 * API calls go via SSH since port 9099 is internal-only.
 *
 * Run: npx playwright test tests/e2e/test_kilocode_agents.ts --project=kilocode-agents
 */

const VPS_HOST = '187.77.30.206';
const VPS_USER = 'root';
const SSH = 'C:\\Program Files\\Git\\usr\\bin\\ssh.exe';
const SCP = 'C:\\Program Files\\Git\\usr\\bin\\scp.exe';
const PIPELINE_KEY = '0p3n-w3bu!';

interface AgentDef {
  id: string;
  name: string;
  testPrompt: string;
}

const AGENTS: AgentDef[] = [
  { id: 'kc-main', name: 'KiloCode Main', testPrompt: 'What can you help me with? Reply in 2 sentences.' },
  { id: 'kc-01', name: 'Integration Lead', testPrompt: '@kc-01 How do I integrate two microservices? Reply in 2 sentences.' },
  { id: 'kc-02', name: 'Creative Brainstormer', testPrompt: '@kc-02 Give me one idea for a task management app. Reply in 2 sentences.' },
  { id: 'kc-03', name: 'System Architect', testPrompt: '@kc-03 What is an API gateway? Reply in 2 sentences.' },
  { id: 'kc-04', name: 'Bug Triage Specialist', testPrompt: '@kc-04 How do you triage intermittent failures? Reply in 2 sentences.' },
  { id: 'kc-05', name: 'Root Cause Analyst', testPrompt: '@kc-05 What is root cause analysis? Reply in 2 sentences.' },
  { id: 'kc-06', name: 'Code Generator', testPrompt: '@kc-06 Write a one-line Python hello world. Reply in 2 sentences.' },
  { id: 'kc-07', name: 'Code Reviewer', testPrompt: '@kc-07 What makes a good code review? Reply in 2 sentences.' },
  { id: 'kc-08', name: 'Test Writer', testPrompt: '@kc-08 What is a unit test? Reply in 2 sentences.' },
  { id: 'kc-09', name: 'Debugger', testPrompt: '@kc-09 What is a null pointer exception? Reply in 2 sentences.' },
  { id: 'kc-10', name: 'Refactorer', testPrompt: '@kc-10 What is code refactoring? Reply in 2 sentences.' },
  { id: 'kc-11', name: 'Documenter', testPrompt: '@kc-11 What is API documentation? Reply in 2 sentences.' },
  { id: 'kc-12', name: 'Security Auditor', testPrompt: '@kc-12 What is SQL injection? Reply in 2 sentences.' },
  { id: 'kc-13', name: 'Performance Analyst', testPrompt: '@kc-13 What is latency? Reply in 2 sentences.' },
  { id: 'kc-14', name: 'API Integrator', testPrompt: '@kc-14 What is a REST API? Reply in 2 sentences.' },
  { id: 'kc-15', name: 'Database Specialist', testPrompt: '@kc-15 What is an index in SQL? Reply in 2 sentences.' },
  { id: 'kc-16', name: 'DevOps Engineer', testPrompt: '@kc-16 What is CI/CD? Reply in 2 sentences.' },
  { id: 'kc-17', name: 'Frontend Specialist', testPrompt: '@kc-17 What is a React component? Reply in 2 sentences.' },
  { id: 'kc-18', name: 'Backend Specialist', testPrompt: '@kc-18 What is an ORM? Reply in 2 sentences.' },
  { id: 'kc-19', name: 'Research Analyst', testPrompt: '@kc-19 Compare REST vs GraphQL in one sentence each.' },
  { id: 'kc-20', name: 'Prompt Engineer', testPrompt: '@kc-20 What is prompt engineering? Reply in 2 sentences.' },
];

/** Run a command on the VPS via SSH using execFileSync (avoids shell escaping) */
function ssh(remoteCmd: string): string {
  return execFileSync(SSH, [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=10',
    `${VPS_USER}@${VPS_HOST}`,
    remoteCmd,
  ], { timeout: 120_000, encoding: 'utf-8' });
}

/** Upload a local file to the VPS */
function scp(localPath: string, remotePath: string): void {
  execFileSync(SCP, [
    '-o', 'StrictHostKeyChecking=no',
    localPath,
    `${VPS_USER}@${VPS_HOST}:${remotePath}`,
  ], { timeout: 30_000 });
}

/** Parse SSE response into full content string */
function parseSSE(raw: string): string {
  let content = '';
  const lines = raw.split('\n').filter(l => l.startsWith('data: ') && !l.includes('[DONE]'));
  for (const line of lines) {
    try {
      const chunk = JSON.parse(line.slice(6));
      content += chunk?.choices?.[0]?.delta?.content ?? '';
    } catch { /* skip */ }
  }
  return content;
}

test.describe('KiloCode 21-Agent Pipeline E2E', () => {
  test.describe.configure({ mode: 'serial' });

  // Upload test helper scripts to VPS before all tests
  test.beforeAll(async () => {
    // Create a bash test helper on VPS that handles all curl calls
    const helperScript = `#!/bin/bash
# KiloCode agent test helper — receives action + args
ACTION="$1"
PIPELINE="http://localhost:9099"
KEY="${PIPELINE_KEY}"

case "$ACTION" in
  models)
    curl -s -H "Authorization: Bearer $KEY" "$PIPELINE/models"
    ;;
  valves)
    curl -s -H "Authorization: Bearer $KEY" "$PIPELINE/kilocode_agents_pipeline/valves"
    ;;
  minimax-direct)
    API_KEY="$2"
    curl -s -X POST https://api.minimaxi.chat/v1/chat/completions \\
      -H "Authorization: Bearer $API_KEY" \\
      -H "Content-Type: application/json" \\
      -d '{"model":"MiniMax-M2.7-highspeed","messages":[{"role":"user","content":"say ok"}],"max_tokens":5}'
    ;;
  agent)
    PROMPT="$2"
    curl -s -X POST "$PIPELINE/chat/completions" \\
      -H "Authorization: Bearer $KEY" \\
      -H "Content-Type: application/json" \\
      -d "{\\"model\\":\\"kilocode_agents_pipeline\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"$PROMPT\\"}]}"
    ;;
esac
`;
    const localHelper = join(tmpdir(), 'kc_test_helper.sh');
    writeFileSync(localHelper, helperScript.replace(/\r\n/g, '\n'), 'utf-8');
    scp(localHelper, '/tmp/kc_test_helper.sh');
    ssh('chmod +x /tmp/kc_test_helper.sh');
  });

  test('Pipeline health — loaded in pipelines container', async () => {
    const raw = ssh('bash /tmp/kc_test_helper.sh models');
    const data = JSON.parse(raw);
    const ids = data.data.map((m: any) => m.id);
    expect(ids).toContain('kilocode_agents_pipeline');
    console.log('✅ Pipeline loaded, models:', ids.join(', '));
  });

  test('Valves — MiniMax M2.7-highspeed configured', async () => {
    const raw = ssh('bash /tmp/kc_test_helper.sh valves');
    const valves = JSON.parse(raw);
    expect(valves.minimax_model).toBe('MiniMax-M2.7-highspeed');
    expect(valves.minimax_base_url).toBe('https://api.minimaxi.chat/v1');
    expect(valves.minimax_api_key).toBeTruthy();
    expect(valves.minimax_api_key.startsWith('sk-')).toBe(true);
    console.log('✅ Valves: model=%s, url=%s, key=sk-...%s',
      valves.minimax_model, valves.minimax_base_url, valves.minimax_api_key.slice(-8));
  });

  test('MiniMax direct — M2.7-highspeed API key is funded', async () => {
    // Get API key from valves
    const valvesRaw = ssh('bash /tmp/kc_test_helper.sh valves');
    const apiKey = JSON.parse(valvesRaw).minimax_api_key;

    const raw = ssh(`bash /tmp/kc_test_helper.sh minimax-direct ${apiKey}`);
    expect(raw).not.toContain('insufficient_balance');
    expect(raw).not.toContain('authorized_error');
    expect(raw).toContain('choices');
    console.log('✅ MiniMax M2.7-highspeed API key is valid and funded');
  });

  for (const agent of AGENTS) {
    test(`Agent ${agent.id} — ${agent.name}`, async () => {
      test.setTimeout(120_000);

      const raw = ssh(`bash /tmp/kc_test_helper.sh agent '${agent.testPrompt}'`);
      const content = parseSSE(raw);

      // Must have substantive response
      expect(content.length, `${agent.id} response too short`).toBeGreaterThan(20);

      // Must show correct agent name in header
      expect(content, `Should route to ${agent.id}`).toContain(agent.id);

      // Must use MiniMax provider
      expect(content, `${agent.id} should use MiniMax`).toContain('MiniMax');

      const preview = content.slice(0, 150).replace(/\n/g, ' ');
      console.log(`✅ ${agent.id} (${agent.name}): ${preview}...`);
    });
  }
});
