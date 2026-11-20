# Showdown Guard target access (K-026/K-098, X-043, X-047)

Worker: Kiro CLI 3.5.0 worker on Alex's Mac, branch `kiro/showdown-sprint-guard-access`, 2026-11-20 (America/Los_Angeles).
No human playtest, no screen-reader listening and no native Safari run are recorded here.

## Question

On a legal Bone Wall (Guard) turn reached through normal entry, can a keyboard or assistive-technology user
find the allowed targets and learn why, before choosing and after the Guard falls?

## Route (scripted, not human)

`scripts/browser-showdown-guard-access-check.mjs`, seed 0, fresh profile, built graybox over loopback HTTP.
Play opens the Camp; a click bot wins Boot Hill and Raven Roost and takes the first offered card each time;
The Bone Fence opens from its Camp tile; the bot plays until a Cowboy turn has a ready troop and a Bone Wall
stands on the Wizard side. From there every input is a key press (Tab or Option+Tab, Enter).

## Observed

| Run | Result | File |
| --- | --- | --- |
| Chrome 158 headless, before the fix, Chrome accessibility tree (CDP) | Focus lands on the Bone Wall, named with "Guard"; its accessible description is empty. The reason ("A Guard stands in the way: attack it first.") is only in `#sd-prompt`, which is not live and not referenced. Blocked troops and Base are disabled with no reason. | [chrome-before-fix.json](chrome-before-fix.json) |
| Chrome 158 headless, after the fix | 11 checks pass: focused Guard target and blocked troop/Base descriptions give the Guard reason; the only enemy Tab stop is the Bone Wall; four keyboard attacks defeat it and `#sd-feedback` (aria-live polite) announces each; the next pick focuses the Wizard troop with description "Choose what to attack. …". | [chrome-after-fix.json](chrome-after-fix.json) |
| Playwright WebKit 27.2 (build 2370; the engine behind Safari, not Safari) after the fix | 12 checks pass. Plain Tab reaches no button (macOS WebKit default), so the run uses Option+Tab. Focus order is WebKit's own; descriptions come from the DOM `aria-describedby` reference, because this build exposes no native AX tree. | [webkit-after-fix.json](webkit-after-fix.json) |

Native desktop Safari: **pending**. `safaridriver` is installed but Safari's Allow Remote Automation is not
enabled (`defaults read com.apple.Safari AllowRemoteAutomation`: key does not exist). Enabling it changes a
global setting and a session would take over a Safari window, so it was not done. VoiceOver was not used.

## Fix (src/ui/showdown-screen.js)

While an attack or spell is aimed, each enemy troop button and the enemy Base button get
`aria-describedby="sd-prompt"`. The description is the screen's existing prompt text; no new wording, rule or
visual. Fable keeps any wording choice.

## Kiro CLI PostToolUse hook

`.kiro/hooks/check-showdown-guard-access.json` (trigger `PostToolUse`, matcher `write`, timeout 180 s) runs
`scripts/showdown-guard-access-hook.mjs`. The script reads the hook event on STDIN, skips any path other than
`src/ui/showdown-screen.js` and `src/game/showdown/presenter.js`, otherwise rebuilds the graybox and runs the
Chrome check. It logs one line per dispatch.

- Native dispatch, V3 engine (`kiro-cli chat --agent-engine v3 --no-interactive --trust-workspace --trust-tools=fs_read,fs_write`,
  session `sess_3212e1c1-466b-46f1-9c15-796eda97f20b`): unrelated file write → skipped; `str_replace` removing the
  cue on troop slots → failed ("focused target description "" gives no Guard reason"); restoring it → passed
  (11 checks). [kiro-cli-v3-hook-dispatch.jsonl](kiro-cli-v3-hook-dispatch.jsonl), [transcript](kiro-cli-v3-probe-transcript.txt).
  The probe agent reported seeing no hook text in its tool results, so the dispatch is proven by the log, not by
  the agent reacting to it.
- First probe without `--agent-engine`: `--no-interactive` defaults to the V2 engine, which does not load
  `.kiro/hooks/*.json`; no dispatch was logged. [kiro-cli-v2-probe-transcript.txt](kiro-cli-v2-probe-transcript.txt).
- Script-only runs by hand (piped JSON, not Kiro): README.md → skipped; showdown-screen.js → passed.

**Source references.** Last Rites runs an accessibility audit when a matching scare file changes. InteractionKit described hooks tied to a newly defined gesture. Showdown checks the targeted presenter edit against one playable Guard turn. [Last Rites hook, X-043](https://github.com/dismality/last-rites/blob/37932b0e95be5f9707db5178ab31d06a5c8a628b/.kiro/hooks/scare-accessibility-audit.json) · [Kiroween Hackathon Wrapped, video 11 at 25:14, X-047](https://www.youtube.com/watch?v=q8-bONv7G7E&t=1514s).
