/**
 * Global Teardown for Cross-Surface Parity Tests
 * Cleans up test data after test run
 */
import { request, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Global Teardown: Cleaning up test environment...');
  
  const hubUrl = process.env.HUB_URL || 'http://localhost:8095';
  const token = process.env.HUB_ADMIN_TOKEN || 'dev-token';
  
  const apiContext = await request.newContext({
    baseURL: hubUrl,
    extraHTTPHeaders: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  try {
    // 1. Clean up test thread if created
    const testThreadId = process.env.E2E_TEST_THREAD_ID;
    if (testThreadId) {
      // Mark thread as closed rather than deleting
      await apiContext.post(`/api/warroom/threads/${testThreadId}/close`, {
        data: { reason: 'test_cleanup' },
      });
      console.log(`✓ Test thread ${testThreadId} closed`);
    }
    
    // 2. Reset test agent presence
    const agents = ['kc-01', 'kc-02', 'kc-03']; // Test agents
    for (const agentId of agents) {
      await apiContext.post(`/api/warroom/agents/${agentId}/heartbeat`, {
        data: { online: false, status: 'idle' },
      });
    }
    console.log(`✓ Test agent presence reset`);
    
    // 3. Clear any test approval requests
    const approvalsResponse = await apiContext.get('/api/warroom/approvals');
    if (approvalsResponse.ok()) {
      const approvals = await approvalsResponse.json();
      for (const approval of approvals.approvals || []) {
        if (approval.requester_id?.includes('test')) {
          await apiContext.post(`/api/warroom/approvals/${approval.request_id}/resolve`, {
            data: {
              resolution: 'cancelled',
              resolver_id: 'test_teardown',
              reason: 'Test cleanup',
            },
          });
        }
      }
      console.log(`✓ Test approvals cleaned up`);
    }
    
    // 4. Generate test report summary
    console.log('\n📊 Test Environment Summary:');
    
    const [health, state, roadmap] = await Promise.all([
      apiContext.get('/health'),
      apiContext.get('/api/warroom/state'),
      apiContext.get('/api/roadmap/summary'),
    ]);
    
    if (health.ok()) {
      const h = await health.json();
      console.log(`  Hub: ${h.status} v${h.version}`);
    }
    
    if (state.ok()) {
      const s = await state.json();
      console.log(`  War Room: ${s.state.online_agents}/${s.state.total_agents} agents online`);
    }
    
    if (roadmap.ok()) {
      const r = await roadmap.json();
      console.log(`  Roadmap: ${r.overall_progress}% complete`);
    }
    
    console.log('\n✅ Global teardown complete\n');
    
  } catch (error) {
    console.error('⚠️ Global teardown warning:', error);
    // Don't fail on teardown errors
  } finally {
    await apiContext.dispose();
  }
}

export default globalTeardown;
