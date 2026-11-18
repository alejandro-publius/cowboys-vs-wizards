# Wanted board

Open **Wanted** from the graybox main menu. The Graveyard Dragon poster has five different starting boards. The monsters hold their lanes and strike at the clash. Defeat the Dragon while your Base survives. The poster counts each board once and supports replay.

Clear all five boards to earn **Bounty Hunter** and unlock **Captured Dragon**, a one-copy reward troop with 3 attack, 2 orbs, and a one-tribute cost. **Clean Capture** rewards winning a hunt with every starting Base orb intact. In **Build Deck**, use **Load Dragon Posse** to try a legal list with the reward in place of Mounted Billy.

Kiro Opus 5.5 designed the five authored positions and wrote the reusable bounty-designer agent. Codex integrated the hunt and reward in the graybox. The short fights give players four distinct plans: Ride Out, tribute into a threatened lane, reinforce and cast Deadeye, or Ride Out and cast Deadeye. Each has a one- or two-clash solution. In Safari, Codex cleared all five, repeated a clear without gaining progress, unlocked the card and summoned it in a separate seed-15 trial. Kiro reported 4.41 estimated credits for the design task.

## A repeatable content workflow

Choose the project's **bounty-designer** agent in Kiro, or launch `kiro-cli chat --agent bounty-designer` from the project. Give it one player decision to build a hunt around. It drafts the encounter, deck, reward and 3D brief under `tasks/bounties/`. For example, ask for a Lantern Wraith hunt that makes committing to a lane feel risky, with a reward suited to Billy Posse.

Use Tripo after the encounter earns a place in the game. Tripo exposes its official local MCP server through `npx -y tripo-cli mcp`. Kiro can connect to a local MCP server for a separate asset step after the account is connected. Have that step generate a GLB from the chosen card brief and record its source. The browser can play the packaged hunt using the shipped deck and board data.

[Kiro custom agents](https://kiro.dev/docs/custom-agents/) · [Tripo MCP and CLI](https://developers.tripo3d.ai/en/mcp)
