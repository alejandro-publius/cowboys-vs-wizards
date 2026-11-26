# Showdown judge demo narration

The November 26 cut runs 1 minute 20 seconds. The screen recordings show the public game on `b69ca62`. The Kiro chapter displays the archived native workflow record, then lines 19 and 20 of the tracked spec. The soundtrack is English narration using Kokoro’s stock `am_michael` voice. The review copy includes burned-in captions and an English subtitle track. [Uploadable English captions](night-shift-demo.en.srt) · [Voice model](https://huggingface.co/hexgrad/Kokoro-82M)

## November 26 transcript

**0:00 · Billy at Bone Wall**

Cowboys versus Wizards lets card players test a balance change before it hits their deck. Billy breaks Bone Wall. Kiro wants to take one point off that shot. [November 26 public game](https://github.com/alejandro-publius/cowboys-vs-wizards/commit/b69ca6204d2fce52aa588e227279a49249605014)

**0:10 · The same shot**

Try the shot again. Same Billy, same wall. This time it survives with one orb. Let the bots play on, and the Wizards win on turn twenty. [Pinned rules for the two attacks](../../scripts/billy-replay-engine.mjs)

**0:20 · The Headless Horseman**

But you can take Billy’s next turn. The Headless Horseman is right in front of him. Shoot, and the Wizards still win. Two turns sooner. [Player choices](../../src/ui/saloon-billy-table.js)

**0:29 · Take cover**

Back up to that same turn and take cover. Now the Cowboys win on turn twenty-one. The weaker Billy still had a way out. [Same turn, same rules](../../src/ui/saloon-billy-table.js)

**0:38 · The Kiro workflow**

That shot began in a Kiro workflow. One agent could change one number on one card. [Still rendered from the native Kiro CLI tool stream](../evidence/kiro-night-shift-native.png)

**0:45 · The written rule**

A separate reviewer used this spec. Each faction had to win between forty-five and fifty-five percent of the bot games. [Balance requirements, NSB-1 and NSB-2](../../.kiro/specs/night-shift-balance-contract/requirements.md)

**0:54 · The held-out test**

We tested twenty-five thousand unseen deals, from both seats, with both versions of Billy. Across a hundred thousand bot duels, Cowboy wins fell from fifty-nine point eight percent to fifty-one point nine. The first player still had an edge. [Paired bot audit and source data](../evidence/billy-seat-audit/README.md)

**1:11 · Play the deal**

Billy still hits for two on the Trail. At the Night Shift Saloon, you can play the proposed change before it ever reaches your deck. [Play the Saloon](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review)

## Earlier 1:59 cut

The private review cut runs 1:59 and uses captions and a temporary synthetic guide voice. The gameplay was scripted and recorded from the [published build at `dad6175`](https://github.com/alejandro-publius/cowboys-vs-wizards/commit/dad6175052475624ccb05c974fbee1deab087bc4). These are the words and chapter times for recording the owner’s narration.

## 0:00 · Ride or Fight?

The published title opens the Bone Fence position.

In Cowboys versus Wizards, a Skeleton stands between your Outrider and the Wizard Base. What do you do?

## 0:07 · Fight, then ride

The target picker shows the Skeleton and the Wizard Base. Both moves start from the same turn.

Fight the Skeleton. It drops to two orbs, but it hits back. Your Outrider has just one orb left. Try the same turn again. Ride past the Skeleton and you hit the Wizard Base for one. Both troops keep their orbs.

## 0:22 · Deck builder and Wanted bounties

The deck builder shows 16 cards. Wanted shows The Lantern Wraith and The Graveyard Dragon, with their Trail requirement.

In Camp, build a sixteen-card deck from your collection. Winning Trail duels gives you more cards to work with. Finish the Trail and the Wanted board opens two boss bounties. Each one awards a different card.

## 0:35 · Kiro’s balance workflow

The still was rendered from native Kiro CLI workflow `wf_87723b3404bba1fc`. The project recorded its actual tool calls. [Workflow still](../evidence/kiro-night-shift-native.png)

Behind the game, Kiro ran a balance experiment. A designer gave the agent room to change one number. A separate reviewer checked the result.

## 0:44 · The recorded proposal

The public Saloon opens at the archived Billy decision. [Recorded review](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review)

You can inspect the decision in the Night Shift saloon. Kiro proposed taking Billy from two attack to one. The live card still has two.

## 0:53 · Billy vs. Bone Wall

The four states for each version come from the public Sheriff’s Ledger. [Recorded deal](../evidence/billy-replay.md)

Watch the same deal play out in the Sheriff’s Ledger. At two attack, Billy knocks down Bone Wall. The Cowboys win on turn thirteen. Give Billy one attack. Bone Wall hangs on by one orb. This time, the Wizards win on turn twenty.

## 1:08 · The held-out balance audit

The held-out audit uses 25,000 deals and 50,000 games per version. The separate replay sample shown in the Ledger uses 5,000 games per version. [Audit protocol and counts](../evidence/billy-seat-audit/README.md)

Would that change hold up on a different deal? Two bots played twenty-five thousand deals, from both seats, with both versions of Billy. Across 100,000 duels, Cowboy wins fell from about 59.8% to 51.9%. The opening player still won about 58% of the time.

## 1:28 · The independent referee

The referee checked 274,273 alternate moves at the 4,986 positions with a next move. The 5,086 main-line positions include the 100 final positions. [Audit report and controls](../evidence/claude-referee-legal-branches.md)

In 100 duels, a separate Python referee matched all 5,086 positions on the played path. It also checked over 274,000 alternate moves. It found 6,775 differences and classified them all. One rule is open. Can you cast Hellfire on an empty board? The game refuses. The referee allows it.

## 1:52 · Play Showdown

The end card gives the public game URL. [Play Showdown](https://alejandro-publius.github.io/cowboys-vs-wizards/)

Try Ride or Fight from the title, then replay your choice. You can see exactly what your rider risked.
