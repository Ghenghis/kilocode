# Research Sources and Rationale

This kit is based on stable Git/GitHub workflow practices and current public documentation checked April 27, 2026.

## Sources to cite in reports

1. GitHub Docs — Syncing a fork. Use as support for keeping a fork aligned with upstream.
2. GitHub Docs — Protected branches. Use as support for blocking force pushes/deletions and requiring rules on protected branches.
3. GitHub Docs — Managing branch protection rules. Use as implementation reference for GitHub-side protection.
4. Atlassian Git Feature Branch Workflow. Use as support for isolating development in feature branches.
5. Atlassian Gitflow Workflow. Use as support for release branches and separation of release history from feature work.
6. Git documentation — git bundle. Use as support for bundle backups and offline repository transfer/restore.
7. GitHub glossary / Git docs — cherry-pick. Use as support for extracting selected changes from polluted history.

## Why these practices were selected

- Feature branches isolate work and reduce risk when upstream moves quickly.
- Protected branches prevent accidental destructive actions on default branches.
- Mirror and bundle backups protect both refs and history before dangerous operations.
- Release branches let DaveAI assemble selected custom work without polluting upstream mirror branches.
- Adversarial agent review reduces false completion claims.
