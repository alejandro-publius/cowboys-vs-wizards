#!/bin/sh
# Invoked by the duel-presenter Kiro agent's SessionStart hook.
# Output goes to ignored .artifacts/kiro/; tracked evidence under docs/evidence/ is left alone.
mkdir -p .artifacts/kiro
report=".artifacts/kiro/ui-hook.txt"
{
  printf 'Kiro duel-presenter SessionStart check\n'
  date -u '+%Y-%m-%dT%H:%M:%SZ'
  node --test tests/match/presenter.test.js tests/match/controller.test.js tests/match/card-model.test.js
} > "$report" 2>&1
result=$?
cat "$report"
exit "$result"
