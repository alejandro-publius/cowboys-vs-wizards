# Night Watch for Kiro Crew

Night Watch gives game developers a way to check a card edit before shipping it. Choose two commits from a local Cowboys vs. Wizards checkout in Crew and run the same deals on both. The dashboard shows which card stats changed, who won and how often the opening side won. A failed rule check or a large swing comes with a prefilled GitHub issue draft. [Crew app and setup](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch)

In the earlier lane game, giving the Skeleton four health instead of three moved Wizard wins from 472 to 663 on the same 1,000 seeds. The installed dashboard showed the edit alongside the 19.1 percentage-point swing. [Recorded dashboard comparison](../evidence/kiro-night-watch.md)

On November 20, the 2 a.m. Pacific Crew job checked two Showdown commits. Bots played 1,000 deals from both starting seats on each revision. The counts matched exactly. In each set of 2,000 games, Cowboys won 1,188 and the side that went first won 1,142. The candidate passed 361 rule tests. The receipt includes both commits, the seed range and a command to reproduce the run. [Scheduled report 4195c6c07cda](../evidence/night-shift/crew-scheduled-2026-11-20.json)

Kiro CLI wrote the simulator adapter and HTTP backend. Codex connected the Crew dashboard and scheduler. The game repository includes the Showdown runner used in the scheduled check. [Showdown runner and replay instructions](../../apps/night-watch/README.md)
