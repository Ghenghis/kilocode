# Boot Gate / Safemode / Repair Completion Contract

## On boot / restart / refresh / launch
Must check:
- runtime core
- provider router
- Hermes bridge
- ledgers/state
- repair lane
- WebUI path

## If any critical failure exists
Must:
- deny normal UI unlock
- enter safemode
- emit repair packet
- run repair worker
- revalidate
- unlock only after pass

## Required proof
- captured logs
- UI screenshots
- repair evidence ledger
- explicit unlock transition evidence
