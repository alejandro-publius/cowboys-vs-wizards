# Lore keeper review: Night Shift saloon

Reviewer: one native Kiro CLI agent (model `claude-opus-5.5`) working in the
`12-expert-reviews` worktree. The same agent wrote every review in this panel,
each through a different lens.

Method: compared the four saloon roles with the card catalog, the art briefs
in [`prototypes/showdown/art.js`](../../../prototypes/showdown/art.js) and the
stage code. No images were viewed and no command ran in this pass. Claims
about how the miniatures look need a rendered review.

Lens: do the saloon's characters say what the game's cards already say, with
nothing invented?

## K1. Singularity is a Wizard spell, but the saloon casts it as a character

- **Question:** Requirements 1.1 and 1.5 give "Singularity" a person's
  actions: it hands out a job and rings a bell. The introduction calls the
  four roles "original game miniatures". Is Singularity one?
- **Record:**
  - [`cards/wizard-singularity.json`](../duel-card-pipeline/cards/wizard-singularity.json)
    has `"kind": "spell"` and `"effect": "shot"`.
  - The art brief at `art.js` lines 105–107 describes "A whirlpool of violet
    light with a pure black centre, tearing a hole in the air … the
    graveyard at night".
  - [`saloon-stage.js`](../../../src/ui/showdown-3d/saloon-stage.js) lines
    10–16 place `wizard-singularity` as an actor and give it `job` and
    `bell`.
- **Observed:** In the catalog, Singularity is a Wizard-side spell with no
  body. In the saloon it is the neutral dispatcher of the whole shift: it
  issues every job, rings the end-of-shift bell, and makes 18 of the 25
  recorded ambient moves. No rulebook or art brief gives a spell a role, a
  side-neutral job or a bell.
- **Status:** open. This is a design decision for the user and Fable. The
  saloon may already be approved as shipped. This pass found no record of
  that approval in the three specs.
- **Acceptance check:** Either requirements.md records that Singularity
  acting as the shift's dispatcher is an approved, deliberate departure from
  its card, with a link to the decision, or the dispatcher role moves to an
  existing character card. In both cases a rendered review confirms the
  miniature reads as the intended thing.

## K2. "Bounty Hunter" is a role name, not a card

- **Question:** Does any card or rule name a Bounty Hunter?
- **Record:**
  - `ACTORS` at
    [`night-shift-saloon.js`](../../../src/ui/showdown-3d/night-shift-saloon.js)
    lines 40–44:
    `{id: "hunter", card: "cowboy-ranger", role: "Bounty Hunter"}`.
  - [`cards/cowboy-ranger.json`](../duel-card-pipeline/cards/cowboy-ranger.json)
    has the name "Ranger", tag `Lawman` and key `scout`.
  - The art brief (`art.js` line 69) shows "a weathered tracker … a brass
    spyglass".
- **Observed:** The Ranger painting fits a tracker who posts Wanted bills, and
  the Lawman tag supports it. The on-screen role name still differs from the
  card name the player knows from Camp and the deck. Requirement 1.4 also
  says "Bounty Hunter" and never mentions the Ranger.
- **Status:** open (naming).
- **Acceptance check:** requirements.md states that the Bounty Hunter is
  played by the Ranger card. The actor label either shows "Ranger" or keeps
  "Bounty Hunter" by decision. If the label changes, the strings test
  asserts the chosen label.

## K3. Requirement 1.8 names `assets/`, but the 3D miniatures are built in code

- **Question:** Requirement 1.8 says art SHALL come from approved assets in
  `assets/`. Where do the saloon figures come from?
- **Record:**
  - `saloon-stage.js` calls `makeCardModel` from
    [`card-models.js`](../../../src/ui/showdown-3d/card-models.js). That
    function builds card miniatures in code with the `Miniature` builder and
    the rig files (`western-rigs.js`, `wizard-rigs.js`, `wraith-rigs.js`,
    plus `sheriff.js` and `dragon.js`), and throws when a card has none
    ("Missing Showdown illustration").
  - `art.js` lines 186–188 list `cowboy-ranger` among the cards that still
    have no model in `assets/models/`.
  - The portrait room uses the card paintings through `portrait()`.
  - The saloon stage's own header comment says "All set dressing is static
    stage-owned primitives".
- **Observed:** The Ranger and Singularity figures are the same coded
  miniatures the released illustrated game uses. Nothing new is invented for
  the saloon. They are, however, not files in `assets/`, so 1.8 as written is
  not literally met. The room set (table, bell, poster, window) is new
  stage geometry.
- **Status:** open (requirement wording). No new-art violation was found.
- **Acceptance check:** Requirement 1.8 names its actual sources: card
  paintings in `assets/` for portraits, the released `card-models.js`
  miniatures for the stage, and stage-owned primitives for the set. It also
  links the approval of the set dressing, or marks that approval as pending
  the user.
