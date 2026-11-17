# Card catalog summary (read-only review)

Source: the eight card JSON files in `.kiro/specs/duel-card-pipeline/cards/`. Fields are copied as the files state them.

**Limitation:** the cards carry no prose backstory, only name, faction (`side`) and numeric/flag fields. This summary adds no lore, mechanics, stats or art claims. The theme remarks below are about names and factions only.

## Cowboy faction

| Card | type | side | order | kind | stars | health | attack | relocates | copies |
|---|---|---|---|---|---|---|---|---|---|
| Sheriff | cowboy-sheriff | cowboy | 1 | troop | 2 | 3 | 1 | not stated | 6 |
| Billy | cowboy-billy | cowboy | 2 | troop | 5 | 4 | 2 | not stated | 3 |
| Mounted Billy | cowboy-mounted-billy | cowboy | 3 | troop | 7 | 5 | 3 | not stated | 1 |
| Deadeye | cowboy-deadeye | cowboy | 4 | spell | not stated | not stated | not stated | false | 2 |

- Sheriff: a lawman title that suits a Western cowboy faction.
- Billy: an outlaw-style first name that suits the Western setting.
- Mounted Billy: the name adds a horse-riding form of Billy, which fits Western imagery.
- Deadeye: a Western term for a sharpshooter, used here as the faction's spell.

## Wizard faction

| Card | type | side | order | kind | stars | health | attack | relocates | copies |
|---|---|---|---|---|---|---|---|---|---|
| Skeleton | wizard-skeleton | wizard | 1 | troop | 1 | 3 | 1 | not stated | 6 |
| Wizard | wizard-wizard | wizard | 2 | troop | 5 | 4 | 2 | not stated | 3 |
| Dragon | wizard-dragon | wizard | 3 | troop | 8 | 5 | 3 | not stated | 1 |
| Singularity | wizard-singularity | wizard | 4 | spell | not stated | not stated | not stated | true | 2 |

- Skeleton: an undead figure that gives the wizard side its haunted tone.
- Wizard: a direct fantasy-magic counterpart to the cowboy side.
- Dragon: a fantasy creature that fits the wizard faction's supernatural side.
- Singularity: an arcane, cosmic-sounding spell name; the file states only `relocates: true`.

## Notes on rules

- Each file's `kind` is either `troop` or `spell`. Only troops carry `stars`, `health` and `attack`; only spells carry `relocates`.
- This summary does not interpret `stars` or `relocates` beyond the file values.
- The cowboy and wizard ladders have parallel structure: order 1 to 4, with copies 6, 3, 1 and 2.
