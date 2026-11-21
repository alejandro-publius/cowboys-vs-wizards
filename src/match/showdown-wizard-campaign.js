// The Wizard preview (Fable's ruling, "Wizard preview"): four fixed duels from the Wizard seat against the
// Cowboy bot, then "Open range, Wizard seat". Fixed reward swaps and grit only: no offers, packs or builder.
// Modelled on showdown-practice.js and the Cowboy campaign object (showdown-campaign.js) so the screen can take
// it as a per-start campaign (seat "wizard"). Its own save holds only {v: 1, wins, losses} under its own key;
// decks are derived. It never reads or writes a Cowboy key or the playtest log. Pure: storage is passed in.
import {DECKS, RARITY, TYPES} from "../game/showdown/cards.js";
import {GRIT_CAP, deckAfter} from "../game/showdown/trail.js";

export const WIZARD_PREVIEW_KEY = "cvw-showdown-wizard-preview-v1";
export const PREVIEW_LABEL = "Wizard preview";
export const OPEN_RANGE_ID = "wizard:open";
const DECK_SIZE = 16;
const WIZARD_BASE = 5;

export const WIZARD_STARTER = Object.freeze({"wizard-skeleton": 10, "wizard-wizard": 3, "wizard-singularity": 3});

// level: how well the Cowboy bot plays (rules.js playTurn). base: Cowboy Base orbs. The Wizards open every duel.
// reward: [card earned, card it replaces, copies], paid on the first win. Numbers are Fable's final table (../ruling.md):
// Wagon Ring's deck is the one measured replacement; Trapline Pass ships at Cowboy Base 3. The Wizard Base is 5 + grit.
export const WIZARD_TRACK = Object.freeze([
  {id: "dry-gulch", name: "Dry Gulch", level: 0, base: 3, deck: {"cowboy-sheriff": 16},
    lesson: "Your Wizard costs one tribute, then raises the last Undead in your graveyard with 1 orb. Pay with a Skeleton and it returns, unless all three slots are full.",
    reward: [["wizard-raven-familiar", "wizard-skeleton", 2]]},
  {id: "wagon-ring", name: "Wagon Ring", level: 0, base: 4, deck: {"cowboy-sheriff": 14, "cowboy-covered-wagon": 2},
    lesson: "A Raven Familiar draws a card when it arrives. Pay for the Wizard with it and an earlier Skeleton rises instead. A Covered Wagon has Guard: it must fall first.",
    reward: [["wizard-bone-wall", "wizard-skeleton", 2]]},
  {id: "trapline-pass", name: "Trapline Pass", level: 1, base: 3, deck: deckAfter(4),
    lesson: "A Bone Wall has Guard. Their face-down card is a Bear Trap: send a raised 1-orb Skeleton in first.",
    reward: [["wizard-imp", "wizard-skeleton", 1], ["wizard-hex", "wizard-singularity", 1]]},
  {id: "high-noon", name: "High Noon", level: 1.5, base: 4, deck: DECKS.cowboy,
    lesson: "The whole posse, played with a plan. Your Imp strikes the turn it arrives; your Hex cancels one attack.",
    reward: [["wizard-dragon", "wizard-wizard", 1]]},
].map((duel) => Object.freeze({...duel, deck: Object.freeze({...duel.deck})})));

// The Wizard deck after `wins` track wins: the starter with each earned card swapped in.
export function wizardDeckAfter(wins) {
  const deck = {...WIZARD_STARTER};
  for (const {reward} of WIZARD_TRACK.slice(0, wins)) {
    for (const [earned, replaced, copies] of reward) {
      deck[replaced] -= copies;
      deck[earned] = (deck[earned] ?? 0) + copies;
    }
  }
  return Object.fromEntries(Object.entries(deck).filter(([, copies]) => copies > 0));
}

// ?wizard=1 opens the preview: exactly one wizard value, exactly "1". Precedence is the app's.
export function wizardFromQuery(search) {
  const values = new URLSearchParams(search).getAll("wizard");
  return values.length === 1 && values[0] === "1";
}

// The Camp shows the preview once the Cowboy save has won Boot Hill. Reads only.
export const previewUnlocked = (cowboyProgress) => Number.isInteger(cowboyProgress?.wins) && cowboyProgress.wins >= 1;

const whole = (value) => Number.isInteger(value) && value >= 0;
const fresh = () => ({v: 1, wins: 0, losses: 0});
// Exactly {v: 1, wins: 0..4, losses: whole}; anything else starts fresh.
function valid(raw) {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw)
    && Object.keys(raw).sort().join() === "losses,v,wins"
    && raw.v === 1 && whole(raw.wins) && raw.wins <= WIZARD_TRACK.length && whole(raw.losses);
}
// The stored text: a string, null when the key is absent, undefined when storage cannot be read.
function text(storage) {
  try {
    return typeof storage?.getItem === "function" ? storage.getItem(WIZARD_PREVIEW_KEY) : undefined;
  } catch {
    return undefined;
  }
}
// The save a stored text holds, or null when it is absent or invalid.
function parse(stored) {
  try {
    const raw = JSON.parse(stored ?? "null");
    return valid(raw) ? {v: 1, wins: raw.wins, losses: raw.losses} : null;
  } catch {
    return null;
  }
}

// A 16-card deck of Wizard cards within their rarity caps (a best of three's own copy of the deck).
function wizardDeck(deck) {
  if (!deck || typeof deck !== "object") return false;
  const entries = Object.entries(deck);
  return entries.every(([type, copies]) => TYPES[type]?.side === "wizard" && Number.isInteger(copies) && copies >= 0 && copies <= RARITY[TYPES[type].rarity][1])
    && entries.reduce((sum, [, copies]) => sum + copies, 0) === DECK_SIZE;
}

const trackId = (duel) => `wizard:${duel.id}`;
const empty = () => ({cards: [], packs: 0, captured: null});

export function createWizardPreview(storage) {
  // synced: the stored text as this tab last read or wrote it.
  let synced = text(storage);
  let save = parse(synced) ?? fresh();
  let saved = true;
  // A failed write keeps the progress in memory; synced stays what storage holds, so it is not thrown away later.
  const keep = (next) => {
    save = next;
    try {
      if (typeof storage?.setItem !== "function") throw new Error("no storage");
      const written = JSON.stringify(save);
      storage.setItem(WIZARD_PREVIEW_KEY, written);
      synced = written;
      saved = true;
    } catch {
      saved = false;
    }
  };
  // Another tab (or "Start preview over" there) changed the key since this tab last read or wrote it: that value wins,
  // so an old tab can neither pay a win twice nor bring back a save that was started over. An unreadable store changes nothing.
  const sync = () => {
    const stored = text(storage);
    if (stored === undefined || stored === synced) return;
    synced = stored;
    save = parse(stored) ?? fresh();
  };
  const deck = () => wizardDeckAfter(save.wins);
  const done = () => save.wins >= WIZARD_TRACK.length;
  function duel(id, played) {
    const wizard = wizardDeck(played) ? {...played} : deck();
    if (id === OPEN_RANGE_ID) {
      return done() ? {id, kind: "wizard", seat: "wizard", preview: true, name: "Open range, Wizard seat", level: 2, reward: [],
        lesson: "An even match with your whole posse of the dead against the full Cowboy deck. The Cowboys plan every turn. It pays nothing.",
        options: {decks: {wizard, cowboy: {...DECKS.cowboy}}}} : null;
    }
    const index = save.wins;
    const open = WIZARD_TRACK[index];
    if (!open || id !== trackId(open)) return null;
    return {id, kind: "wizard", seat: "wizard", preview: true, index, name: open.name, lesson: open.lesson, level: open.level, reward: open.reward,
      options: {decks: {wizard, cowboy: {...open.deck}}, baseOrbs: {wizard: WIZARD_BASE + Math.min(save.losses, GRIT_CAP), cowboy: open.base}, first: "wizard"}};
  }
  return {
    label: PREVIEW_LABEL,
    progress: () => ({...save, deck: deck(), side: {}, offer: null}),
    saved: () => saved,
    duels: () => [
      ...WIZARD_TRACK.map((each, index) => ({id: trackId(each), kind: "wizard", index, name: each.name,
        state: index < save.wins ? "won" : index === save.wins ? "open" : "locked"})),
      {id: OPEN_RANGE_ID, kind: "wizard", index: WIZARD_TRACK.length, name: "Open range, Wizard seat", state: done() ? "open" : "locked"},
    ],
    trailDuel: () => (done() ? null : duel(trackId(WIZARD_TRACK[save.wins]))),
    duel,
    owned: (type) => deck()[type] ?? 0,
    choose() { throw new Error("the Wizard preview has no offers"); },
    // Records a finished duel once, won from the Wizard's side. Only the duel open now counts: a second settle,
    // a stale tab or a retry of a won duel pays nothing. The key is read again first (sync above).
    settle(finished, won) {
      sync();
      const index = save.wins;
      const open = WIZARD_TRACK[index];
      const nothing = {won: Boolean(won), earned: empty(), intoDeck: [], grit: open ? Math.min(save.losses, GRIT_CAP) : 0};
      if (finished?.kind !== "wizard" || !open || finished.id !== trackId(open) || finished.index !== index) return nothing;
      if (!won) {
        keep({v: 1, wins: index, losses: save.losses + 1});
        return {...nothing, grit: Math.min(save.losses, GRIT_CAP)};
      }
      keep({v: 1, wins: index + 1, losses: 0});
      return {won: true, earned: {...empty(), cards: open.reward.map(([type, , copies]) => [type, copies])},
        intoDeck: open.reward.map(([type, replaced, copies]) => [type, copies, replaced]), grit: 0};
    },
    // Start preview over: this key only. Ask the player first.
    reset() { keep(fresh()); return saved; },
  };
}
