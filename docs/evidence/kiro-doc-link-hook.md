# Kiro documentation link hook (issue 46)

Status: hook config added; real trigger proof pending.
Source: integration candidate 099847adcaa03a228a7a3eb421889501a355e4bd (not main).

Hook: `.kiro/hooks/check-project-doc-links.json`, PostFileSave on `docs/**/*.md`,
runs `scripts/check-doc-links-hook.mjs`, which runs `scripts/check-links.mjs`
(offline) and writes `.artifacts/doc-link-hook/receipts.jsonl`.
