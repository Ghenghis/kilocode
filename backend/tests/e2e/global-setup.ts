/**
 * Global Setup for Cross-Surface Parity Tests
 * Ensures test environment is ready before tests run
 */
import { request, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Global Setup: Preparing test environment...');
  
  const hubUrl = process.env.HUB_URL || 'http://localhost:8095';
  const token = process.env.HUB_ADMIN_TOKEN || 'dev-token';
  
  // Create request context
  const apiContext = await request.newContext({
    baseURL: hubUrl,
    extraHTTPHeaders: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  try {
    // 1. Verify Hub is healthy
    const healthResponse = await apiContext.get('/health');
    if (!healthResponse.ok()) {
      throw new Error(`Hub health check failed: ${healthResponse.status()}`);
    }
    
    const health = await healthResponse.json();
    console.log(`✓ Hub healthy: ${health.status} v${health.version}`);
    
    // 2. Initialize test data
    // Create a test thread in War Room
    const threadResponse = await apiContext.post('/api/warroom/threads', {
      data: {
        title: 'E2E Test Thread',
        created_by: 'test_setup',
        metadata: { test: true },
      },
    });
    
    if (threadResponse.ok()) {
      const thread = await threadResponse.json();
      process.env.E2E_TEST_THREAD_ID = thread.thread.id;
      console.log(`✓ Test thread created: ${thread.thread.id}`);
    }
    
    // 3. Seed MCP tools with test state
    const serversResponse = await apiContext.get('/api/mcp/servers');
    if (serversResponse.ok()) {
      const servers = await serversResponse.json();
      console.log(`✓ MCP servers: ${servers.total} configured, ${servers.healthy} healthy`);
    }
    
    // 4. Verify agent registry
    const agentsResponse = await apiContext.get('/api/agents');
    if (agentsResponse.ok()) {
      const agents = await agentsResponse.json();
      console.log(`✓ Agents: ${agents.agents?.length || 0} registered`);
      
      // Validate 21-agent setup
      if (agents.agents?.length !== 21) {
        console.warn(`⚠ Expected 21 agents, found ${agents.agents?.length}`);
      }
    }
    
    // 5. Check settings canonical
    const settingsResponse = await apiContext.get('/api/settings/canonical');
    if (settingsResponse.ok()) {
      const settings = await settingsResponse.json();
      console.log(`✓ Settings canonical ready: version ${settings.version_hash?.slice(0, 8)}...`);
    }
    
    console.log('✅ Global setup complete\n');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await apiContext.dispose();
  }
}

export default globalSetup;
