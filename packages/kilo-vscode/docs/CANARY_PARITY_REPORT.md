# Canary 10 → Canary 11 Feature Parity Audit

**Method:** Cross-reference of `dist/{extension,webview,agent-manager}.js` strings between `kilocode-maos-7.2.21-canary.10.vsix` and the live `packages/kilo-vscode/dist/` after 12 parallel agents. The packaged `kilo-code-7.2.21-canary.11.vsix` on disk is stale (12 min older than `dist/`, 7 MB smaller); END state lives in `dist/`.

## 1. Bundle sizes (END vs canary.10, bytes)

| Bundle | c10 | c11 vsix | live dist END | END − c10 |
|---|---:|---:|---:|---:|
| extension.js | 8,056,149 | 8,059,757 | **9,993,389** | +1,937,240 |
| webview.js | 16,155,471 | 15,455,298 | **18,300,116** | +2,144,645 |
| agent-manager.js | 16,606,996 | 15,418,243 | **17,981,815** | +1,374,819 |
| diff-viewer.js | 14,022,953 | 14,020,771 | **15,476,279** | +1,453,326 |
| diff-virtual.js | 13,906,352 | 13,904,170 | **15,182,471** | +1,276,119 |
| kiloclaw.js | 10,135,000 | 10,132,997 | **11,013,545** | +878,545 |

Live build is unminified (dev mode), inflating sizes; the vsix on disk must be re-packaged before sign-off.

## 2. Pre-existing gaps that were FIXED

- **49 new webview shells**: `AboutKiloCodeTab, AgentBackendsTab, AgentBehaviourTab, ApiView, AutoApproveTab, AutocompleteTab, BrowserTab, CheckpointsTab, CloudImportDialog, CommitMessageTab, ContextTab, CustomProviderDialog, DisplayTab, ExperimentalTab, FeedbackDialog, GovernanceTab, HermesTab, HubTab, LanguageTab, MarketplaceListView, McpEditView, MemoryTab, ModeCreate/EditView, ModelsTab, NotificationsTab, OAuthAuto/CodeView, OpenClawTab, PresetsTab, ProfileForm, Provider*Dialog, ProvidersTab, SSHTab, SpeechTab, TrainingTab, VPSTab, WorkflowsTab, WorkstationTab, ZeroClawTab` + 4 root views restored (`ChatView, HistoryView, MarketplaceView, ProfileView`).
- **44 new extension handlers**: branchMessage, captureEditorScreenshot, checkpoint{Compare,GetDiff,Label}, exportConversation, generateSshKey, getAutoApprove*, listKnownHosts, openInTab, pauseTask, rateMessage, refreshContext, retryLast/ToolRequest, runCodeBlock, sshGetKeyFingerprint/TestConnection, voice/SSH suite.
- **24 new ext response types** (autoApprove*, browserStatus, checkpointBranch/Compare/Diff/LabelResult, mentionSuggestions, messageBranched/Rated, sshKey/Connection, voiceInputResult, terminalCreated, taskPaused, sessionPreviewLoaded).
- **4 new VS Code settings**: `kilo-code.autoApprove.{conditions,log,rateLimits}`, `kilo-code.new.settingsPanel`.
- **OpenClaw rename complete** (9 `openclaw*` cases replace `zeroclaw.update`/`zeroClawContext`).
- **Workstation suite added** (7 webview cases).

## 3. Remaining gaps (END state)

### 3a. Webview UI senders missing (31 feature msgs)
Extension handlers exist; React UI never posts. Fix in `packages/kilo-vscode/webview-ui/src/components/`:
- **Memory** (`MemoryTab.tsx`): memoryBulk{Delete,Export,Tag}, memoryClearAll, memoryExport, memoryImport, memorySetAutoCompact.
- **Governance** (`GovernanceTab.tsx`): governance{GenerateComplianceReport,ImportRules,SetThresholds,SimulateCommand}.
- **Hermes** (`HermesTab.tsx`): hermes{DiscardDeadLetter,ReconnectChannel,RetryDeadLetter}.
- **Training** (`TrainingTab.tsx`): training{Annotate,Export,FindDuplicates,GetConsent,GetDataset,Preview,SetConsent}Item/Dataset.
- **Checkpoint** (`CheckpointsTab.tsx` + chat menu): checkpoint{Compare,CreateBranch,GetDiff,Label}.
- **Custom Provider** (`CustomProviderDialog.tsx`): testCustomProvider{Connection,Model}, detectCustomProviderEnv.
- **Misc**: previewFileEditsResponse, exportConversation, exportText, captureEditorScreenshot, openDiffForFile, openInEditorRequest, openInTab, pauseTask, rateMessage, requestRulesFiles, createRulesFile, getMentionSuggestionsRequest.

### 3b. Webview response cases missing (~9)
checkpoint{Compare,CreateBranch,Diff}Result, hermes{ChannelTrace,ChannelsUpdate,DeadLetterQueue,KeyConfigured,QueueStats}, memory{ClearAll,Export}Result, sshKeyFingerprintResult, sshKnownHostRemoved, sshTestResult, training{Consent,Items,Preview,DuplicateCheck}, zeroClawContext, zeroclaw.update. Fix in `webview-ui/src/context/ExtensionStateContext.tsx` reducer.

### 3c. Extension handlers missing (6)
createRulesFile, requestRulesFiles, swRegistration{Failed,Ok}, testNotification, testProviderKey → `packages/kilo-vscode/src/kilo-provider/handlers/` (rules + test-diagnostics).

### 3d. Settings keys missing
`kilo-code.swCache.lastClearedVersion`, `kilocode.palette.{pins,recentTabs}` → `package.json` `contributes.configuration`.

### 3e. Routes missing (3)
`/api/v2/moderation/{check,custom_check,user_report}` → moderation service in `packages/kilo-vscode/src/services/`.

### 3f. i18n missing (45 settings.*, 1 common.*)
All `settings.agentBehaviour.{color,createMode.clone,editMcp.testConnection.*,editMcp.{local,remote,discoveredTools,transportAutoDetected},editMode.{preview,previewTitle,clone,importMode,unsavedChanges,unsavedHint},addMcp.arg.placeholder}`; `settings.context.fileLimits.{maxFileSize,maxLineLength,readLimit,rulesDir,title}`, `settings.context.mentionCheatsheet.*` (10 sub-keys), `settings.context.systemPromptPreview.{button,description,title}`, `settings.context.rulesFiles.empty`, `settings.navGuard.{dismiss,save,undo,unsaved}`, `common.clearSearch`. Fix in `webview-ui/src/i18n/en.ts` and propagate.

### 3g. Agent-manager bundle regressions
74 feature msg types + 54 response cases present in c10's `agent-manager.js` are absent from c11's. Tab shells (HermesTab, MemoryTab, GovernanceTab, TrainingTab, SSHTab, etc.) are re-added but don't post messages. Fix: port postMessage senders from canary.10 source `agent-manager/src/components/*/Tab.tsx`.

## 4. Recommended next actions

1. **Repackage** vsix (`pnpm vsix`) — current on-disk vsix is stale.
2. **Wire agent-manager Tabs (P0)** per §3g — biggest remaining gap.
3. **Add 31 webview senders (P1)** per §3a — handlers exist, UI needs buttons.
4. **Add 9 webview response handlers (P1)** per §3b.
5. **Add 6 ext handlers + 3 settings keys + 3 moderation routes (P2)** per §3c–§3e.
6. **Add 45 i18n keys (P3)** per §3f.

Re-run `/tmp/xref.sh` after repackage; expect feature-specific gaps ≤10.
