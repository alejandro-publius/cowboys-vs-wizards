# Judge checkout and receipt guard

Antigravity added the judge devcontainer, the initial receipt guard and the blog wording. Codex corrected the hook registration and property receipt verification during review. The [requirements](../../.kiro/specs/judge-container-and-subagent-guard/requirements.md) cover JCS-1 through JCS-6.

## Judge devcontainer

Open the repository in Codespaces, or use **Dev Containers: Reopen in Container** in Kiro IDE with a running Docker-compatible engine. The [configuration](../../.devcontainer/devcontainer.json) requests Node 22, Python 3.12 and `npm ci`. To inspect the Python referee, run `python3 proof/referee/referee.py --check-catalog prototypes/showdown/cards.csv`. To check the candidate balance receipt, run `node scripts/billy-balance-gate.mjs --arm candidate`. [Kiro devcontainer guide](https://kiro.dev/docs/ide/remote-development/dev-containers/)

To use the forwarded ports, run `node scripts/night-shift-saloon.mjs` for the loopback witness on 4179. For the playable site on 8080, run `node scripts/stage-pages.mjs --commit "$(git rev-parse HEAD)"` and then `python3 -m http.server 8080 --bind 127.0.0.1 --directory dist/web`.

## Local receipt verification

The [installed hook](../../.kiro/hooks/stop-receipt-guard.json) runs the [receipt guard](../../scripts/check-subagent-stop.mjs) on ordinary `Stop`. Run it directly from the repository root with `node scripts/check-subagent-stop.mjs Stop`. It checks the committed bundle paths against their SHA-256 seals and checks the property run entries against the scorecard's receipt rules. Each test file must also contain fast-check at the cited commit. A shallow clone needs the commit named in its receipt. CI fetches that exact object from the project repository. To prepare a shallow judge checkout, run these commands from its root:

```sh
revision=$(node -p "require('./reports/properties/latest.json').commit")
git fetch --no-tags --depth=1 origin "$revision"
git cat-file -t "$revision"
node scripts/check-subagent-stop.mjs Stop
```

The original 20-entry receipt cited `e1e2d325`, which lacks its named test file. The corrected 105-entry receipt from PR #234 cites `70303354`, which contains all four named test files. The checked-in test fetches the historical commit in an isolated depth-one clone and rejects a test added after the recorded run. It also verifies missing, empty and damaged receipts. A successful run reports the evidence found in that checkout.

## Optional Kiro CLI 3.6+ SubagentStop hook

Kiro documents a separate V3 event when a dispatched subagent finishes. The [example registration](../../.kiro/examples/hooks/subagent-stop-receipt-guard.json) is opt-in. To install it for a witness session, copy it from the project root, then start Kiro CLI 3.6 or later in V3 mode. [Kiro event contract](https://kiro.dev/docs/hooks/types/#subagent-stop-cli-v3-only)

```sh
cp .kiro/examples/hooks/subagent-stop-receipt-guard.json .kiro/hooks/
```

Codex checked the registration, this copy command and the guard using synthetic events. The installed CLI reported version 3.5.0. A native 3.6+ dispatched-worker receipt is pending before default activation. The devcontainer passed the official Dev Container base JSON Schema. The catalog and balance commands ran on the host. A container boot remains unverified here because the Docker daemon was inaccessible.

## Bonus blog draft

The [publishable article](../submission/build-story.md) includes “being written as part of the Kiroween 2026 hackathon” and retains `published: false`. Third-party publication is pending with the owner, as recorded in the [submission packet](../submission/devpost-packet.md).

## Focused checks

```sh
node --test tests/game/devcontainer-and-subagent-hook.test.js tests/match/night-shift-presence.test.js tests/game/dec4-scorecard.test.js tests/game/dec4-trace.test.js tests/assets/links.test.mjs
node scripts/trace.mjs --require JCS-
```
