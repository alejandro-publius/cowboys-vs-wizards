#!/bin/sh
# Run the same card check on save and during the review Workflow.
out=.artifacts/kiro/card-hook.txt
if [ "${1:-}" = "--save-hook" ]; then out=.artifacts/kiro/card-save-hook.txt; fi
mkdir -p .artifacts/kiro || exit 1
log="$out.$$.tmp"
{
    node scripts/sync-card-specs.mjs &&
        node scripts/sync-card-specs.mjs --check &&
        node --test tests/game/card-specs.test.js
} > "$log" 2>&1
status=$?
printf 'overall exit %s\n' "$status" >> "$log"
mv "$log" "$out" || exit 1
cat "$out"
exit "$status"
