# Requirements: Dec 4 Hundred-Property Fast-Check Verification Suite

## Normative requirements

### Showdown Catalog, Combat, Keywords, Forecasts, and Bots

- PROP-001: THE Showdown card catalog (`TYPES`) SHALL map every entry in `SHOWDOWN_SPECS` to a valid side, kind, rarity in `RARITY`, known keywords in `KEYWORDS`, and a known `EFFECTS` entry for every non-troop card.
- PROP-002: FOR ALL catalog types and positive copy numbers, `typeOf` and `cardOf` SHALL recover the exact base card type and specification from `${type}-${copy}`.
- PROP-003: FOR ALL Showdown troop cards, `tributes(cardId)` SHALL return `0` for `1..4` stars, `1` for `5..6` stars, and `2` for `7` or more stars.
- PROP-004: FOR ALL per-card positive integer count maps of a faction, `deckIds(side, counts)` SHALL produce unique suffixed card IDs whose count per type and total length equal the input map.
- PROP-005: THE `EVEN_FIGHT_DECKS` table SHALL keep `16` cards per side and differ from `DECKS` solely by replacing one `wizard-skeleton` with one `wizard-imp`.
- PROP-006: WHEN `createShowdown` runs with `evenFight: true` and default `baseOrbs`, THE engine SHALL grant `7` Base orbs to the second player and `5` to the first player, whereas `evenFight: false` grants `5` to both sides.
- PROP-007: WHILE `state.turn === 1`, `canAttack` SHALL return `false` and `legalActions(state)` SHALL omit all `attack` actions even for `Quickdraw` or opening-board troops.
- PROP-008: WHEN a zero-tribute troop arrives on `turn >= 2`, THE engine SHALL mark `ready` as `true` and allow same-turn attacks if and only if the troop carries `quickdraw`.
- PROP-009: WHEN a troop requiring `1` or `2` tributes is summoned on `turn >= 2`, THE engine SHALL move the tributed troops and their attached gear to `discard`, decrease occupied board count by `tributes - 1`, and mark the summoned troop `ready` to attack.
- PROP-010: WHILE the defending board holds at least one `guard` troop, `legalActions(state)` SHALL restrict every attacker's targets exclusively to enemy `guard` slots and forbid direct Base or non-Guard strikes.
- PROP-011: WHILE the defending board holds non-Guard troops and zero `guard` troops, `legalActions(state)` SHALL allow `"base"` targeting only for `ride` attackers, and `attackOutcome` for that ride-past strike SHALL deal `1` Base damage.
- PROP-012: WHEN the defending board has zero troops, ANY ready attacker SHALL be permitted to target `"base"` and deal its full `attackOf(state, attacker)` to the defending Base.
- PROP-013: WHEN an attacker defeats an uncovered troop with `attack > defender.health`, THE excess damage SHALL reduce the defending Base, whereas a defender in `cover` SHALL absorb all excess damage and deal `0` counter-damage.
- PROP-014: WHEN an uncovered defender survives an attack (`defender.health > attack`), THE defender SHALL deal `attackOf(state, defender)` counter-damage to the attacker (clamped at `0`) and `0` damage passes to the Base.
- PROP-015: WHEN a `sweep` attacker strikes an enemy troop on an untrapped board, EVERY other occupied enemy board slot SHALL lose `1` orb and move to `discard` if reduced to `0`.
- PROP-016: WHEN a combatant with `laststand` is reduced to `0` orbs in combat while the opposing combatant retains at least `1` orb, THE survivor SHALL lose `1` additional orb, and spells or tributes SHALL NOT trigger `laststand`.
- PROP-017: WHEN a `scout` troop is summoned from hand, THE active side SHALL draw `1` card if `deck` is non-empty and `hand.length < 6`, burn `1` card to `discard` if `hand.length === 6`, and take `0` fatigue damage if `deck` is empty.
- PROP-018: WHEN a `raise` troop is summoned with an open friendly slot after tributes, THE engine SHALL return the most recently discarded `Undead` troop (`newestUndeadIndex`) to the board at `1` orb (`ready: false`), skipping non-Undead discards.
- PROP-019: WHILE a troop has `ghostly`, targeted spells (`shot`, `tie`) SHALL exclude its slot from `legalActions`, whereas untargeted `hellfire` SHALL still deal `1` damage to exposed `ghostly` troops.
- PROP-020: WHILE `state.evenFight` is `true`, enemy troops in `cover` SHALL be immune to both targeted spells and `hellfire`, whereas under `evenFight: false` `cover` SHALL NOT block spells.
- PROP-021: WHEN `cowboy-lasso` (`tie`) hits an enemy troop, THE target SHALL become `stunned` without losing health, SHALL NOT be legal for a second `tie` or `attack` while stunned, and SHALL clear `stunned` when its side ends turn.
- PROP-022: WHEN gear (`cowboy-six-shooter` or `wizard-bone-armor`) attaches to a friendly troop, THE carrier's `attackOf` and `health` SHALL increase by the gear's bonuses, and defeating the carrier SHALL move both troop and gear to `discard`.
- PROP-023: WHEN a location (`cowboy-sheriffs-office` or `wizard-boneyard`) is active, THE `+1` attack bonus SHALL apply symmetrically to matching-tag troops on both sides, duplicate-name location plays SHALL be illegal, and replacing a location SHALL discard the prior location to its owner's graveyard.
- PROP-024: WHEN an enemy troop attacks into face-down traps, THE oldest trap SHALL spring first (`FIFO`): `wizard-hex` SHALL cancel the attack with `0` damage, and `cowboy-bear-trap` SHALL deal `2` damage first and cancel the attack if and only if the attacker drops to `0` orbs.
- PROP-025: ONCE any troop executes `attack` or `cover` during a turn (`state.attacking === true`), `legalActions(state)` SHALL forbid all `summon`, `spell`, `gear`, `location`, and `set` actions for the remainder of that turn.
- PROP-026: WITHIN a single turn, `applyAction` SHALL permit at most one `summon`, at most one `spell`/`gear`/`location` cast, and at most one `set` trap (while `traps.length < 2`).
- PROP-027: WHEN a side begins its turn with due entries in `state.arrivals`, EACH due boss that fits on an empty board slot SHALL land at `ready: false` with its configured `health`, while overflow entries remain queued if the board is full.
- PROP-028: FOR ALL reachable states with zero enemy traps and all legal `attack` actions, `forecastAttack(state, slot, target)` SHALL emit the exact `events` and `defendingBoard` produced by `applyAction(state, action)`.
- PROP-029: FOR ALL legal `attack` actions, `presentAttackForecast` SHALL return non-empty prose and prefix `"Without trap effects: "` if and only if `view.sides[foe].trapCount > 0`.
- PROP-030: FOR ALL events emitted by `applyAction` across Showdown play, `presentEvent` SHALL return a non-empty log sentence and SHALL throw on any event type absent from `EVENTS`.
- PROP-031: FOR ALL states and actions, `applyAction` SHALL leave its input `state` and `action` deeply unmutated on legal moves and throw synchronously on illegal actions.
- PROP-032: FOR ALL non-terminal Showdown states, `playTurn(state, 0)` SHALL choose only legal non-`cover` actions, advance turn or finish the game, and leave the caller's `state` unmutated.
- PROP-033: FOR ALL non-terminal Showdown states, `playTurn(state, 1)` SHALL deterministically execute legal actions without inspecting face-down enemy trap identities prior to trigger.
- PROP-034: FOR ALL non-terminal Showdown states, `playTurn(state, 1.5)` SHALL execute only legal actions and cleanly complete the active side's turn or finish the duel.
- PROP-035: FOR ALL non-terminal Showdown states, `planTurn(state)` SHALL return the identical action plan under any permutation of the active side's unseen `deck` and any substitution of hidden enemy `traps`.

### Campaign Progression, Deck Validation, Save Codes, and Storage

- PROP-036: FOR ALL Trail win counts `0..6`, `deckAfter(wins)` SHALL contain exactly `16` Cowboy cards with positive integer counts within each card's `RARITY` copy cap.
- PROP-037: THE initial `newSave()` profile SHALL pass `deckProblems` with zero errors, round-trip unchanged through `migrate`, and expose `Boot Hill` as the sole `"open"` duel in `duelList`.
- PROP-038: WHEN `deckProblems(save, deck, side)` inspects candidate counts, THE validator SHALL reject any main deck whose total differs from `16` or any side deck whose total exceeds `4`.
- PROP-039: WHEN `deckProblems` receives any Wizard card, unknown type, negative count, or non-integer count in `deck` or `side`, THE validator SHALL report at least one problem and `withDeck` SHALL throw.
- PROP-040: FOR ALL Cowboy card splits where `deck[t] + side[t]` obeys ownership and rarity caps and `sum(deck) === 16` and `sum(side) <= 4`, `withDeck` SHALL succeed and prune zero-count entries.
- PROP-041: WHEN `settle(save, "trail", false)` records losses on an unfinished Trail duel, `losses.trail` SHALL increment without altering `wins` or `collection`, and `duelFor` SHALL cap Cowboy Base grit bonus at `+2` (`GRIT_CAP`).
- PROP-042: WHEN `settle(save, "trail", true)` records each Trail win `1..6`, `wins` SHALL increment by `1`, `losses.trail` SHALL reset to `0`, `deck` SHALL remain `16` valid cards, and the 6th win SHALL grant `1` pack.
- PROP-043: WHILE `save.offer` holds an unclaimed card pair, `duelFor(save, id)` SHALL return `null` for every Trail, Rival, Bounty, and Open Range duel ID.
- PROP-044: WHEN `choose(save, card)` selects either offered card, THE chosen card's collection count SHALL increase by `1`, `offer` SHALL clear to `null`, `migrate` SHALL preserve the save, and non-offered cards SHALL throw.
- PROP-045: WHILE `save.wins < TRAIL.length`, `duelList(save)` SHALL mark every Rival, Bounty, and Open Range entry `"locked"` and `duelFor` SHALL return `null` for each of them.
- PROP-046: WHEN Rivals are beaten in sequence after the Trail, `settle` SHALL append each rival ID once, grant its configured `reward` cards and `packs`, and unlock the next Rival in `duelList`.
- PROP-047: WHILE a Rival with a unique card reward (`stargazer` or `imp`) remains unbeaten, `pool(save)` SHALL hold back that reward card from post-duel offers and pack draws.
- PROP-048: WHEN `settle(save, "hunt:<id>", true)` clears stages `1..5` of a Wanted bounty, `hunts[id]` SHALL advance monotonically and grant the Legendary `reward` card exclusively upon the 5th clear.
- PROP-049: WHEN `migrate` inspects a v2 save containing a Legendary card without `hunts[bounty.id] === 5`, `migrate` SHALL reject the tampered save back to `newSave()`, and `pool(save)` SHALL never contain Basic or Legendary cards.
- PROP-050: WHEN `settle(save, "open", won)` resolves Open Range duels, losses SHALL leave `save` unchanged and wins SHALL award `1` pack if and only if `openWins` is a positive multiple of `OPEN_WINS_PER_PACK` (`3`).
- PROP-051: WHEN `openPack(save)` runs with `packs >= 1`, `packs` SHALL decrease by `1`, `rolls` SHALL increase by `1`, at most `3` cards within rarity caps SHALL be added, and slot `0` SHALL be non-common whenever `pool(save)` holds one.
- PROP-052: FOR ALL reachable v2 campaign saves and arbitrary surrounding whitespace, `decodeSaveCode(encodeSave(save))` SHALL return `{ok: true, legacy: false}` with `sameSave(decoded.save, save) === true`.
- PROP-053: WHEN `encodeSave` serializes objects containing Unicode characters above `U+00FF`, THE encoder SHALL `\uXXXX`-escape wide code units without throwing and preserve exact string content after `JSON.parse(atob(code))`.
- PROP-054: FOR ALL legacy v1 Trail objects `{wins: 0..6, losses?: >= 0}`, `decodeSaveCode` SHALL return `{ok: true, legacy: true}` with `sameSave(decoded.save, migrate(raw)) === true`.
- PROP-055: FOR ALL arbitrary strings, malformed base64 inputs, oversized strings (`> 16384`), future versions (`v > 2`), and tampered v2 payloads, `decodeSaveCode` SHALL return `{ok: false}` with a non-empty `reason` and SHALL NEVER throw.
- PROP-056: FOR ALL valid v2 campaign saves, permuting key insertion order at top-level and nested count maps SHALL preserve `sameSave` equivalence and `decodeSaveCode` acceptance.
- PROP-057: FOR ALL valid v2 campaign saves, `describeSave(save)` SHALL format exact Trail wins, beaten Rivals, cleared Bounty hunts, collected card copies, and unopened packs.
- PROP-058: FOR ALL arbitrary JavaScript values `x`, `migrate(x)` SHALL NEVER throw, SHALL return a valid v2 save, and SHALL be idempotent (`sameSave(migrate(migrate(x)), migrate(x))`).
- PROP-059: WHEN `saveCampaign` and `loadCampaign` operate on mock storage, valid saves SHALL round-trip identically whereas tampered un-migratable objects SHALL return `{ok: false}` without overwriting existing valid storage.
- PROP-060: WHEN `SAVE_KEY` contains damaged or future-version text and `REFUSED_KEY` is unset, `saveCampaign` SHALL preserve the damaged string in `REFUSED_KEY` before writing and SHALL NOT overwrite an existing `REFUSED_KEY`.
- PROP-061: WHEN `SAVE_KEY` is absent or invalid JSON and `OLD_SAVE_KEY` holds a legacy v1 Trail record, `loadCampaign` SHALL migrate the v1 record cleanly without writing to storage.
- PROP-062: FOR ALL sequences of lane-card arrays, `joinInherited` SHALL maintain the deduplicated set union monotonically under `INHERITED_KEY` without removing previously recorded keepsake cards.
- PROP-063: WHEN `INHERITED_KEY` holds corrupted or wrong-version text, `readInherited` SHALL report `damaged: true` and `joinInherited` SHALL return the in-memory union with `saved: false` without clobbering `INHERITED_KEY`.
- PROP-064: FOR ALL valid saves and inherited card lists, `holdings(save, inherited)` SHALL list each owned catalog card at most once, keeping Showdown copy counts when present in both records and dropping unknown card IDs.
- PROP-065: FOR ALL `cvw-player-v1` storage payloads, `laneCapturedCards` SHALL include a Legendary boss card if and only if all `5` of that boss's lane hunt IDs appear in `clearedHunts`.

### Boot Hill Poker, Seeded RNG, Paired Cohort Kit, and Balance Math

- PROP-066: FOR ALL 32-bit seeds, `mulberry32(seed)` SHALL deterministically emit numbers strictly inside `[0, 1)` (`0 <= x < 1`).
- PROP-067: FOR ALL finite numbers, integer strings, and arbitrary text seeds, `normalizeSeed` SHALL deterministically return an unsigned 32-bit integer (`0 <= s <= 4294967295`) with `normalizeSeed(String(n)) === normalizeSeed(n)` for integers.
- PROP-068: FOR ALL seeds, `shuffleDeck(seed)` SHALL return a 52-card permutation containing every card of `makeDeck()` once (`isCard` true) and replay identically for equal normalized seeds.
- PROP-069: FOR ALL 5-card poker hands and all permutations of those 5 cards, `evaluateHand` SHALL return the identical `category`, `ranks`, `wheel`, and `label`.
- PROP-070: FOR ALL 5-card poker hands and all `24` suit permutations over `S, H, D, C`, relabeling suits SHALL preserve `category`, `ranks`, `wheel`, `label`, and `compareHands` tie status (`0`).
- PROP-071: FOR ALL 5-card poker hands `A`, `B`, and `C`, `compareHands` SHALL satisfy reflexivity (`compareHands(A, A) === 0`), antisymmetry (`compareHands(A, B) === -compareHands(B, A)`), and transitivity.
- PROP-072: ACROSS all nine poker hand categories (`0` High Card through `8` Straight Flush, including the `A-2-3-4-5` wheel), `evaluateHand` and `compareHands` SHALL strictly order higher categories above lower categories and rank `6`-high straight above `5`-high wheel.
- PROP-073: WHEN `evaluateHand` receives wrong hand sizes, invalid card codes, or duplicate cards, THE evaluator SHALL throw `TypeError`.
- PROP-074: FOR ALL 5-card poker hands, `chooseDiscards` SHALL return `[]` under `"pat"`, return sorted valid indices `0..4` under `"standard"`, stand pat on `category >= 4`, and retain all paired/trips/quads cards when `category >= 1`.
- PROP-075: FOR ALL Boot Hill Poker deals and valid human discard subsets (`0..5` indices), THE union of `hands.cowboy`, `hands.wizard`, `deck`, and `muck` SHALL conserve all `52` distinct cards without loss or duplication.
- PROP-076: FOR ALL active human draw turns, `toggleDiscard` SHALL keep `marked[seat]` strictly sorted and duplicate-free, and toggling the same card index twice SHALL restore the prior `marked` array.
- PROP-077: WHILE `state.phase === "draw"`, `viewState(state, seat)` SHALL redact `opponentHand` to five `null` entries, omit `deck` and `muck`, and set `result` to `null`, revealing `opponentHand` and `result` at `phase === "showdown"`.
- PROP-078: FOR ALL Boot Hill Poker states, `replayDeal(state)` SHALL reproduce the identical deal, whereas `nextDeal(state)` SHALL increment `dealNumber`, alternate `first` via `otherSeat`, and advance `seed` via `nextSeed`.
- PROP-079: FOR ALL seeds, seats, and valid strategy configs, `playPokerDuel` SHALL deterministically return `endTurn === 2` and `winner` in `{"cowboy", "wizard", "draw"}`.
- PROP-080: FOR ALL valid `measurePairedCohort` runs, `gamesPerArm` SHALL equal `2 * deals`, arm wins plus draws SHALL equal `gamesPerArm`, and `onPair` SHALL observe pairs in `(seed, sides[0], sides[1])` order with `null` normalized to `"draw"`.
- PROP-081: FOR ALL paired-cohort outcome functions, swapping `playBaseline` and `playCandidate` in `measurePairedCohort` SHALL swap `baseline` and `candidate` tallies while keeping `gamesPerArm` and `switchedWinners` invariant.
- PROP-082: WHEN `measurePairedCohort` receives malformed inputs, reserved `"draw"` side names, async promises, missing winners, or non-positive `endTurn` values, THE runner SHALL throw `PairedCohortError`.
- PROP-083: FOR ALL integer counts `0 <= k <= n` with `n >= 1`, `wilson(k, n)` SHALL satisfy `0 <= lo <= k / n <= hi <= 1` and reflection symmetry `wilson(n - k, n) ≈ [1 - hi, 1 - lo]`.
- PROP-084: FOR ALL integer counts `0 <= k <= n` (`n >= 1`) and integer scale factors `m >= 2`, `wilson(m * k, m * n)` SHALL have strictly narrower width (`hi - lo`) than `wilson(k, n)`.
- PROP-085: FOR ALL faction win shares and seat-skew pairs, `evaluateBalanceRequirements` SHALL mark `NSB-1` passed iff both faction shares lie in `[45, 55]` and `NSB-2` passed iff `seatSkew <= baselineSeatSkew + seatTolerancePp`, rejecting `NaN` inputs as unmeasured.
