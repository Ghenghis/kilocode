# Windsurf Execution Protocol

## Operating mode
Windsurf must treat V17 as:
- a strong handoff pack
- not a completed system

## Work order
1. normalize contradictions in the docs
2. patch WebUI files
3. patch VSIX files
4. patch Hermes / ZeroClaw / runtime files
5. apply deploy/systemd/nginx/scripts
6. run layered real tests
7. produce pass/fail evidence
8. only then update completion claims

## Forbidden
- do not claim complete while stub/TODO/0% contradictions remain
- do not mark proof green without live evidence
