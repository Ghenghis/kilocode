# Phase Roadmap — No-Gaps Execution Plan

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## Phase 0 — Freeze and preserve
1. Stop all agents from pushing.
2. Disable auto-sync tools if enabled.
3. Record date, machine, username, shell, Git version.
4. Create external evidence root.
5. Identify all suspected repo paths.
6. Run read-only repo discovery.
7. Confirm current branch per repo.
8. Confirm uncommitted files.
9. Confirm ignored/untracked files.
10. Open blocker if any repo is not a Git repo.

## Phase 1 — Backup before mutation
11. Create mirror clone for every repo.
12. Create Git bundle for every repo.
13. Create working tree archive excluding heavy dependency folders only after listing them.
14. Save `git status`, `git log`, `git reflog`, `git branch -avv`, `git remote -v`.
15. Hash backup files.
16. Restore mirror backup into a temporary folder.
17. Restore bundle backup into a temporary folder.
18. Confirm restored commit IDs match originals.
19. Confirm untracked important files are archived.
20. Block all mutation if restore proof fails.

## Phase 2 — Remote and upstream truth
21. Identify origin remote.
22. Identify upstream remote or infer from fork metadata/manual known source.
23. Fetch origin read-only.
24. Fetch upstream read-only.
25. Identify default branch: `main` or `master`.
26. Record local HEAD, origin default, upstream default.
27. Calculate ahead/behind counts.
28. Calculate merge-base.
29. Save divergence graph.
30. Open blocker if upstream cannot be accessed.

## Phase 3 — Main/master contamination inventory
31. Compare local default branch against upstream default.
32. Export file diff list.
33. Export commit list unique to local default branch.
34. Export renamed/deleted file list.
35. Export binary/large-file change list.
36. Export submodule changes if present.
37. Export package/dependency file changes.
38. Export config/env changes.
39. Export docs-only changes.
40. Create initial feature candidates.

## Phase 4 — Feature fingerprinting
41. Cluster changes by directory.
42. Cluster by commit message intent.
43. Cluster by import/dependency graph.
44. Cluster by runtime feature area.
45. Cluster by UI surface.
46. Cluster by provider/API integration.
47. Identify cross-repo features.
48. Identify fixes vs features vs chores vs docs.
49. Identify changes that cannot be safely split.
50. Create feature cards.

## Phase 5 — Branch naming and extraction planning
51. Discover existing branch naming style per repo.
52. Define repo-specific branch prefix rules.
53. Map every feature card to one branch name.
54. Mark dependencies between feature branches.
55. Choose extraction method: cherry-pick, patch, file checkout, or manual replay.
56. Define test command per branch.
57. Define expected changed files per branch.
58. Define rollback command per branch.
59. Require quorum approval before branch creation.
60. Block generic names like `feature/update`.

## Phase 6 — Branch extraction
61. Create extraction base from upstream default, not polluted local default.
62. Create one branch per feature card.
63. Apply only selected commits/files/patches.
64. Resolve conflicts with minimal scope.
65. Commit with evidence-linked message.
66. Run diff scope validation.
67. Run security scan.
68. Run build/test/lint when available.
69. Push branch only after Git Safety Officer confirms branch is not `main/master`.
70. Record branch proof.

## Phase 7 — Clean main/master sync
71. Confirm all user changes are backed up and branch-mapped.
72. Confirm no uncommitted files are at risk.
73. Confirm restore proof still exists.
74. Confirm human/operator allows main cleanup phase.
75. Fetch upstream.
76. Reset local default branch to upstream default only after proof.
77. Push default branch only if protected and intentionally syncing fork; otherwise do not push.
78. Confirm status clean.
79. Confirm ahead/behind state.
80. Record sync proof.

## Phase 8 — Cross-repo integration validation
81. Build Kilo Code with Hub changes if present.
82. Build Open WebUI with Hub changes if present.
83. Validate Hermes/Zero Claw API contracts if touched.
84. Validate provider/env assumptions.
85. Validate docs paths.
86. Validate no duplicated Hub launcher remains if integration replaced it.
87. Confirm release dependencies.
88. Create cross-repo feature matrix.
89. Mark features needing synchronized release.
90. Block release if matrix incomplete.

## Phase 9 — Release branch protocol
91. Create release branch from upstream default or chosen clean integration base.
92. Merge selected feature branches only.
93. Resolve conflicts on release branch only.
94. Run full validation.
95. Tag release candidate only from release branch.
96. Never merge release branch to main unless upstream strategy explicitly permits.
97. Keep release notes tied to branch list.
98. Archive evidence.
99. Produce final verdict.
100. Stop.
