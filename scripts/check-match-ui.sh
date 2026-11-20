#!/bin/sh
# Invoked by Kiro agent SessionStart hooks.
#   sh scripts/check-match-ui.sh            lane duel (duel-presenter): its controller, presenter and card model,
#                                           used by the earlier illustrated build (npm run build:art, /3d/ on Pages)
#   sh scripts/check-match-ui.sh showdown   Showdown (showdown-presenter, default Play)
# Output goes to ignored .artifacts/kiro/; tracked evidence under docs/evidence/ is left alone.
mkdir -p .artifacts/kiro
case "${1:-lanes}" in
  lanes)
    report=".artifacts/kiro/ui-hook.txt"
    title="Kiro duel-presenter SessionStart check"
    set -- tests/match/presenter.test.js tests/match/controller.test.js tests/match/card-model.test.js
    ;;
  showdown)
    report=".artifacts/kiro/showdown-hook.txt"
    title="Kiro showdown-presenter SessionStart check"
    set -- tests/game/showdown-presenter.test.js tests/match/showdown-session.test.js tests/match/showdown-cues.test.js
    ;;
  *)
    echo "Use no argument (lane duel) or showdown." >&2
    exit 2
    ;;
esac
{
  printf '%s\n' "$title"
  date -u '+%Y-%m-%dT%H:%M:%SZ'
  node --test "$@"
} > "$report" 2>&1
result=$?
cat "$report"
exit "$result"
