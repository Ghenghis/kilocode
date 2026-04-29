# Daily Standup - [DATE]

## Team Status

### Team A (Auditors) - 25%
- **Yesterday:** [Audited src/zeroclaw/adapters.py, submitted 7-issue report to Team D, began src/proof/ requirements doc]
- **Today:** [Completing audit of src/hermes/orchestrator.py]
- **Blockers:** [None or specific blocker]

### Team B (WebUI) - 20%
- **Yesterday:** [Implemented ControlCenterApp.start(), stop(), get_routes(), created 2 test cases]
- **Today:** [Implementing register_route(), get_metrics(), ProviderPanel.list_providers()]
- **Blockers:** [WebSocket design undefined, Backend API schema undefined]

### Team C (Runtime) - 20%
- **Yesterday:** [Created EventBus class skeleton, implemented connect() stub]
- **Today:** [Implementing EventBus.publish(), subscribe(), disconnect()]
- **Blockers:** [NATS not installed - see Blocker #1]

### Team D (Hermes) - 20%
- **Yesterday:** [Created BaseAdapter class skeleton, addressed Team A audit issues #1-2]
- **Today:** [Implementing BaseAdapter.execute(), validate(), then GitAdapter methods]
- **Blockers:** [None for current work, waiting on src/proof/ and EventBus for later]

### Team E (Integration) - 15%
- **Yesterday:** [None - blocked on Team A requirements]
- **Today:** [Creating src/proof/ directory structure, __init__.py, test_runner.py stub]
- **Blockers:** [Waiting on Team A requirements for proof module]

## Decisions Made
- [Use in-memory broker as NATS fallback - Team C]
- [Ad-hoc API schema approach for Team B until formal design - Team B]
- [Sequential implementation order: BaseAdapter → adapters → proof → integration]

## Blockers to Resolve
| Blocker | Owner | By When | Status |
|---------|-------|---------|--------|
| NATS not installed | DevOps | Today 17:00 | OPEN |
| src/proof/ directory missing | Team E | Today 14:00 | OPEN |
| Team A requirements not delivered | Team A | Today 12:00 | IN PROGRESS |
| WebSocket design undefined | Team B | Tomorrow | OPEN |
| Backend API schema undefined | Team B | Today 17:00 | IN PROGRESS |

## Tomorrow's Plan
- **Team A:** Complete orchestrator audit, begin src/runtime/ review
- **Team B:** ProviderPanel implementation, API endpoint stubs
- **Team C:** EventBus publish/subscribe complete, NATS integration test
- **Team D:** GitAdapter.clone(), push(), pull() implementation
- **Team E:** Wire src/hermes to src/zeroclaw adapters

## Metrics Update
- Methods completed today: [X]
- Tests passing: [Y]
- Completion %: [Z]%
- Hours used today: [H]
- Budget remaining: [B]%

## Notes / Parking Lot
- [Any additional context, decisions, or items for follow-up]
