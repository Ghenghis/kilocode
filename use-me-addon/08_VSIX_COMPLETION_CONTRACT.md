# VSIX Completion Contract

## Required commands
- Sync Runtime Settings
- Open Missing Settings
- Apply Autofill Results
- Set Standard Mode
- Set YOLO Mode
- Set Anonymous Mode
- Queue Active Task
- Submit Completion Packet
- Refresh Provider Health

## Required panels
- RuntimeStatusPanel
- ActiveTaskPanel
- CompletionPacketPanel
- SettingsAutofillPanel
- ProviderStatusPanel
- EvidenceReturnPanel

## Required proof
- startup sync loads real runtime payload
- settings autofill works against real runtime truth
- completion packet reaches runtime
- provider and mode state match WebUI
