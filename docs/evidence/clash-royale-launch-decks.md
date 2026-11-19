# What launch-era Clash Royale teaches the graybox

Supercell identifies January 4, 2016 as its soft launch. A January 8 review describes eight-card decks with four cards in hand at a time. Spending regenerating elixir and choosing where to put a unit were enough to create repeated decisions. A March 8 beginner deck kept half its cards at three elixir or less. Its heavier attackers advanced with ranged support, while surviving defenders could turn into a push. An independent launch guide used Knight plus Archers as an early pairing and gave Arrows a job clearing a path through groups of weak units. These guides describe example decks players could build around launch. [Supercell](https://supercell.com/en/games/clashroyale/blog/news/clash-royales-2nd-birthday/) · [TouchArcade](https://toucharcade.com/2016/01/08/you-need-to-be-playing-clash-royale-right-now/) · [148Apps](https://www.148apps.com/clash-royale/clash-royale-guide-how-to-build-a-solid-deck-with-core-cards/) · [Pocket Gamer](https://www.pocketgamer.com/clash-royale/clash-royale-the-best-deck-for-a-beginner/)

Clash Royale designer Stefan Engblom later explained that each card needs situations where it delivers exceptional value, and that counters create new uses for existing cards. In our duel, Sheriff holds a lane or puts pressure on a Base, Deadeye can save that same Sheriff by removing its blocker, Billy consolidates one troop's value, and Mounted Billy trades two troops for a finisher. Keep those four jobs easy to see. [Game Developer's GDC interview](https://www.gamedeveloper.com/design/-i-clash-royale-i-s-card-balancing-guru-leans-less-on-metrics-more-on-design-intuition)

## Opening decision comparison

The local graybox engine and Normal Wizard policy produced these openings. The starter and Deadeye Control both contain six free Sheriffs among twelve cards. Both have an exact 3.03% chance of drawing no Sheriff in a four-card opening. The preset tests how much value an extra shot creates over a match.

| Seed | What the player sees | First decision |
| --- | --- | --- |
| 0 | Sheriff and three empty lanes | All three Sheriff placements forecast one enemy Base orb of damage if the board holds. This is a clean controls exercise. |
| 14 | Three Billy cards and Mounted Billy against an empty board | The only legal action is End turn. This is a recovery exercise. |
| 60 | Two Sheriffs, Mounted Billy and Deadeye. The Wizard has already played a Skeleton in lane 1. | Sheriff in lane 1 blocks the Base hit and both troops lose an orb. Sheriff in another lane pressures the Wizard Base while the Skeleton pressures yours. The player can resolve the clash immediately. |

Use seed 60 with the starter deck for the next first-player session. Before they summon, ask the player to choose whether to block or trade Base damage and explain what they expect. Then have them end the turn and compare the outcome with their prediction. Repeat seed 0 only if movement or controls were unclear. Record time to the first understood choice, the explanation and whether they ask to replay. Seed 41 adds the later payoff where a one-orb Deadeye shot keeps Sheriff alive and opens the same lane. [Verified Deadeye replay](kiro-graybox-deadeye-pass.md)
