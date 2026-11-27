# How Kiro works behind Showdown

[Full-size animated map](../media/frontier-workflow-map.svg) · [Expanded diagram](../media/frontier-night-shift.svg) · [Phone layout](../media/frontier-night-shift-mobile.svg)

## The Saloon Agent Arena

The Cautious Sheriff and Reckless Wizard each wrote a playbook from the same brief. Kiro's arena referee ran both policies on the game engine, then replayed every recorded decision and the full series. Eight deals played from both starting seats produced a 13–3 Sheriff win. The evidence names each policy and records each decision in the replay. [Arena workflow](../../.kiro/workflows/saloon-agent-arena.workflow.json) · [Sheriff](../../.kiro/agents/cautious-sheriff.json) · [Wizard](../../.kiro/agents/reckless-wizard.json) · [Arena referee](../../.kiro/agents/showdown-arena-referee.json) · [Series and replay](saloon-agent-arena/showcase.json)

## How Billy reached the Saloon

The Night Shift preparer gives the balancing agent a copy of the cards, the test limits and the results of earlier attempts. The agent may change one number on one troop in that copy. A different reviewer checks the edit, runs the same deals with both versions and records a verdict. A failed attempt feeds the next brief. The workflow stops on a pass or after six attempts. [Night Shift workflow](../../.kiro/workflows/night-shift-review.workflow.json) · [Preparer](../../.kiro/agents/contest-balance-preparer.json) · [Balancer's write limits](../../.kiro/agents/showdown-balancer.json) · [Reviewer](../../.kiro/agents/contest-balance-reviewer.json)

In the original local run, Kiro CLI proposed changes to Sheriff, Skeleton and Billy. Only Billy's attack cut from 2 to 1 passed. On both tuning and holdout deals, each faction had to win 45–55% of games, and the opening player's distance from 50% could grow by at most one percentage point. Alex and Fable decide whether to adopt a change. Trail Billy still has 2 attack. [Three proposals and verdicts](kiro-contest-run.md#balance-run) · [Written balance contract](../../.kiro/specs/night-shift-balance-contract/requirements.md)

A later, read-only Kiro workflow checked the fixed Billy proposal. Level-2 bots played 25,000 held-out deals from both starting seats with both versions of Billy in the frozen Node engine. Across those 100,000 duels, Cowboy wins fell from 59.792% to 51.920%. The opening player still won 58.136% with the proposal. [Seat audit workflow](../../.kiro/workflows/billy-seat-audit.workflow.json) · [Auditor](../../.kiro/agents/showdown-seat-auditor.json) · [Recorded audit result](billy-seat-audit/result.json) · [Gate commands](billy-seat-audit/README.md)

## How a player's card request became Dusty Pete

The request described a cheap, tough trail cook. After preflight, the Forge reviewer staged the request and a brief. Kiro's card author supplied the name, an existing troop slot and three stats (attack, health and stars). The reviewer compiled the variant in a disposable copy and played both starting seats. Dusty Pete took the Covered Wagon slot and appeared on the board in 27 of 32 candidate games. That pass established that the variant could compile, play and replay in the sandbox. [Player request](../../examples/card-forge/request.txt) · [Forge workflow](../../.kiro/workflows/player-card-forge.workflow.json) · [Author](../../.kiro/agents/showdown-card-author.json) · [Reviewer](../../.kiro/agents/showdown-card-forge-reviewer.json) · [Dusty Pete's game records](player-card-forge/showcase.json)

Separate tests ran the verifier with an out-of-range stat and a request altered after preparation. In each case it refused the draft before playing a game. [Recorded refusal tests](kiro-forge-refusals.md)

## Who checks the rules and the releases?

- **Independent rules referee.** Claude Code compared Showdown's JavaScript engine with a frozen Python implementation. They agreed at all 5,086 played positions in 100 frozen duels. The audit also examined 274,273 alternate candidates. One open ruling accounts for 39 cases. May a Wizard cast Hellfire against an empty board? The engine refused it and the referee allowed it. [Python referee](../../proof/referee/referee.py) · [Claude Code's audit](claude-referee-legal-branches.md) · [Kiro's first-divergence analysis](kiro-referee-first-divergence.md)
- **Release review.** A Kiro reviewer took an expected commit ID, checked the local copy, ran Node and browser checks, and verified the resulting receipt. Supplying a different commit ID stopped the run before it tested the game. [Review workflow](../../.kiro/workflows/independent-release-review.workflow.json) · [Passing report](showdown-native-release-workflow/positive-report.md) · [Refused run](showdown-native-release-workflow/bad-sha-report.md)
- **Night Watch.** Kiro CLI wrote the simulator adapter and backend. Codex connected the dashboard and scheduler in Kiro Crew. The November 20 job ran at 2 a.m. Pacific and compared two committed revisions on the same 1,000 deals from both seats. Their win counts matched and Crew recorded a steady result. [Crew app](../../apps/night-watch/app.json) · [Showdown runner](../../apps/night-watch/backend/showdown_sim.mjs) · [Scheduled job and result](night-shift/crew-scheduled-2026-11-20.json)

## What the game exposes to Kiro

A native Kiro CLI file-save hook reran ten recorded Outrider decisions after a rules edit. Changing how many orbs a ride strike removed made all ten stale and withheld their Camp links. Restoring the rule made all ten pass again. [PostFileSave hook](../../.kiro/hooks/check-outrider-gate.json) · [Replay experiment](outrider-gate.md) · [Save-event records](outrider-gate/hook-receipts.jsonl)

At Boot Hill, Kiro played through the workspace Model Context Protocol (MCP) server. It received the Cowboy's view and a list of legal moves. The server kept the Wizard's hand private and revealed the deal seed when the game ended. Kiro won in 28 action calls. [Workspace connection](../../.kiro/settings/mcp.json) · [Seat tool implementation](../../.kiro/powers/orb-duel-review/showdown.mjs) · [Boot Hill action record](kiro-showdown-mcp-boot-hill.json)

The installed Orb Duel Review Power played a separate Boot Hill game. That Cowboy win took 23 legal actions. The Power replayed the game against the matching engine. A later session changed one comment in the copied rules file and the same replay was marked stale. [Installed Power sessions](showdown-installed-power.md) · [23-action record](showdown-installed-power/boot-hill-receipt.json)

Codex drew the isometric Saloon on a 240 × 134 pixel grid. The Sheriff and Wizard send sealed playbooks to the umpire’s open ledger. The inventory uses a separate 24 × 24 sprite grid. The linked Arena result supplies the score and replay. [Scene source](../../scripts/frontier_dispatch/scene.py) · [Original sprite sheet](../../scripts/frontier_dispatch/props.py)

To rebuild the three standalone SVGs from the drawing and the recorded results, run `python3 scripts/render-frontier-dispatch.py` with Pillow installed. Append `--check` to compare the output with the published files.
