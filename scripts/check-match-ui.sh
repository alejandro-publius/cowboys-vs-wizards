#!/bin/sh
# Invoked by Kiro agent SessionStart hooks.
#   sh scripts/check-match-ui.sh [showdown]   Showdown (showdown-presenter, default Play)
# Output goes to ignored .artifacts/kiro/; tracked evidence under docs/evidence/ is left alone.
mkdir -p .artifacts/kiro
case "${1:-showdown}" in
  showdown)
    report=".artifacts/kiro/showdown-hook.txt"
    title="Kiro showdown-presenter SessionStart check"
    set -- tests/game/showdown-presenter.test.js tests/match/showdown-session.test.js tests/match/showdown-cues.test.js
    ;;
  *)
    echo "Use no argument or showdown." >&2
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
