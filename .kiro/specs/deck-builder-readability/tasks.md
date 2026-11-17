# Tasks: deck-builder readability

Checked means done and evidenced. Nothing below is checked unless it was actually written. No QA item has run.

## Specification (Kiro CLI)
- [x] 1. Write `requirements.md` (EARS, measurable criteria)
- [x] 2. Write `design.md` with requirement-to-QA mapping
- [x] 3. Write this checklist and `docs/evidence/kiro-deck-builder-readability.md`

## Implementation (Kiro, separate branch; pending after Fable quota stop)
- [ ] 4. Catalog and chosen-deck layout, R1, R2, R4, R5
- [ ] 5. Add/remove control size, keyboard and focus, R3
- [ ] 6. Mobile tabs or stack, R6
- [ ] 7. Preserve behavior, R7

## QA at 1280px and 390px (pending; record real numbers, do not mark passed without them)
- [ ] 8. 1280: art width >=180px per tile; text >=16px; both panels visible; `scrollWidth` <= 1280
- [ ] 9. 390: art width >=150px per tile; text >=16px; `scrollWidth` <= 390; tabs/stack reach every control
- [ ] 10. Controls >=44x44px at both sizes (record smallest measured)
- [ ] 11. Count changes: add/remove each type; per-type count and total update; limits at 0, 6 and 12
- [ ] 12. Invalid feedback: total != 12, no Sheriff; message text shown, Save disabled
- [ ] 13. Save, then reload: saved counts shown; session-only message when storage is unavailable
- [ ] 14. Restore starter deck changes counts only; Back and Escape return to title; Play still works
- [ ] 15. Keyboard: Tab order, Enter/Space on buttons and tabs, visible focus at every stop
- [ ] 16. User visual review of the finished page (not covered by this spec)
