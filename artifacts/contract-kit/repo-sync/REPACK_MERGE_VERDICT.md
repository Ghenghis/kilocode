# DaveAI Repack Merge Verdict

Generated: 2026-04-26.
Method: SHA256 hash comparison of every file in the two repack folders.

## Sources

| Folder | Files | Size |
|--------|-------|-----|
| `G:\Github\contract-kit-v17\DaveAI_Ecosystem_Truth_Skills_Repack-v2` | 535 | 43.3 MB |
| `G:\Github\DaveAI_Ecosystem_Truth_Skills_Repack` | 536 | 53.3 MB |

## Hash diff results

| Bucket | Count | Note |
|--------|-------|------|
| `same` (byte-identical in both) | **535** | Every v2 file matches v1 |
| `only_v1` | 1 | `DaveAI_Ecosystem_Truth_Skills_Repack0.zip` (a zipped archive of the repack itself, ~10 MB) |
| `only_v2` | 0 | v2 introduces no new content |
| `diff` (same path, different hash) | 0 | No file has been modified between the two |

## Conclusion

**v2 and v1 repacks are functionally identical.** The only difference is a
self-contained `.zip` archive present in v1 that is itself just a packaged
copy of the same content. There is nothing in v1 that does not already exist
in v2.

## Recommendation

| Path | Action |
|------|--------|
| `G:\Github\contract-kit-v17\DaveAI_Ecosystem_Truth_Skills_Repack-v2` | KEEP as-is — already inside the source-of-truth repo |
| `G:\Github\DaveAI_Ecosystem_Truth_Skills_Repack` | ARCHIVE & DELETE — fully redundant; the bundled `.zip` adds no information |
| Merge into `contract-kit-v17` proper tree | **NOT REQUIRED** — already inside the repo |

## Verdict

`MERGE_NOT_REQUIRED_REPACK_REDUNDANT`

See `REPACK_MERGE_MANIFEST.csv` for the per-file hash breakdown (536 rows).
