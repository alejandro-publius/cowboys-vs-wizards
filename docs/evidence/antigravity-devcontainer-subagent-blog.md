# Judge checkout and receipt guard

Antigravity added the judge devcontainer, the initial receipt guard and the blog wording. Codex corrected the hook registration and property receipt verification during review. The [requirements](../../.kiro/specs/judge-container-and-subagent-guard/requirements.md) cover JCS-1 through JCS-6.

## Judge devcontainer

The [configuration](../../.devcontainer/devcontainer.json) requests the Node 22 Bookworm image, the Python 3.12 feature and an `npm ci` bootstrap. You can also open the repository in Codespaces. In either container, `python3 proof/referee/referee.py --check-catalog prototypes/showdown/cards.csv` checks the Python referee’s catalog and `node scripts/billy-balance-gate.mjs --arm candidate` checks the proposal on its own. [Kiro devcontainer guide](https://kiro.dev/docs/ide/remote-development/dev-containers/)

The first hosted boot reported Node 22.16.0, below the repository’s 22.18 minimum. The corrected boot used Node 22.23.5 and Python 3.12.16, installed the dependencies, returned `catalog OK` from the Python referee and passed the Billy **candidate** gate on the recorded 100,000 duels. Those runs predate the two-arm check. [First boot](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/45962495706) · [Corrected boot](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/45963132065)

### Reproduce workbook G04

Start Docker and open a fresh clone at the revision under review. From its root, record the host checkout SHA and run the project's image with the same CLI version as CI.

```sh
judge_sha=$(git rev-parse --verify 'HEAD^{commit}')
npx --yes --package=@devcontainers/cli@0.90.0 -- devcontainer up --workspace-folder .
npx --yes --package=@devcontainers/cli@0.90.0 -- devcontainer exec --workspace-folder . node .devcontainer/judge-billy.mjs "$judge_sha"
```

The [judge](../../.devcontainer/judge-billy.mjs) checks the mounted checkout and re-derives the recorded results from the [frozen protocol and outcomes](billy-seat-audit/README.md#integrity). It prints the build and engine SHAs, both commands, their exits and up to 4 KiB per output stream. At attack 2 the historical baseline must exit **2** with NSB-1 red (59.792% Cowboy wins) and NSB-2 passing. At attack 1 the proposal must exit **0** with both rules passing (51.920% Cowboy wins). The recorded games use engine `eedab9385931e093e156fdb7885c470eb2ec64eb`. Rechecking these receipts runs no new duels.

Codex CLI verified both exits and transcripts on macOS arm64 with Node 26.0.0 in a clean shallow clone of PR #244 plus this change. The baseline emitted 533 bytes on stdout and 169 on stderr. The proposal emitted 617 bytes on stdout and zero on stderr. The worker lacked access to the Docker socket.

For hosted evidence, open the PR’s **Checks → Judge devcontainer → boot** job for the revision under review. Save its run URL and download the log archive from the run’s menu. The [workflow](../../.github/workflows/judge-devcontainer.yml) checks Linux, Node, Python, installed dependencies and the Python catalog before invoking the judge in the same container. On pull requests its build SHA identifies GitHub’s tested merge commit.

For the interactive G04 trial, open the fresh clone in Kiro IDE, choose **Dev Containers: Reopen in Container** and wait for `npm ci`. In the container terminal type `node .devcontainer/judge-billy.mjs`, append the full SHA recorded before reopening, and run it. Retain the IDE container indicator, terminal transcript and build SHA for that trial. A hosted run supplies the CI evidence only.

To use the forwarded ports, run `node scripts/night-shift-saloon.mjs` for the loopback witness on 4179. For the playable site on 8080, run `node scripts/stage-pages.mjs --commit "$(git rev-parse HEAD)"` and then `python3 -m http.server 8080 --bind 127.0.0.1 --directory dist/web`.

## Local receipt verification

The [installed hook](../../.kiro/hooks/stop-receipt-guard.json) runs the [receipt guard](../../scripts/check-subagent-stop.mjs) on ordinary `Stop`. Run it directly from the repository root with `node scripts/check-subagent-stop.mjs Stop`. It checks the committed bundle paths against their SHA-256 seals and checks the property run entries against the scorecard's receipt rules. Each test file must also contain fast-check at the cited commit. A shallow clone needs the commit named in its receipt. The PR tests and Pages build both run the same [fetch step](../../scripts/fetch-property-receipt-commit.sh) before the test suite. It fetches that exact object from the project repository. To prepare a shallow judge checkout, run these commands from its root:

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

Codex checked the registration, this copy command and the guard using synthetic events. The installed CLI reported version 3.5.0. A native 3.6+ dispatched-worker receipt is pending before default activation.

## Bonus blog draft

The [publishable article](../submission/build-story.md) includes “being written as part of the Kiroween 2026 hackathon” and retains `published: false`. Third-party publication is pending with the owner, as recorded in the [submission packet](../submission/devpost-packet.md).

## Focused checks

```sh
node --test tests/game/devcontainer-and-subagent-hook.test.js tests/match/night-shift-presence.test.js tests/game/dec4-scorecard.test.js tests/game/dec4-trace.test.js tests/assets/links.test.mjs
node scripts/trace.mjs --require JCS-
```
