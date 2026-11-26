// Screens for the Showdown prototype: the camp (what to play, what you earned), the duel and the deck builder.
// The rules are in rules.js and everything a player keeps is in progress.js; this file only shows them.
import {DECKS, EFFECTS, KEYWORDS, RARITY, TYPES, cardOf, tributes} from "./cards.js";
import {viewFor} from "./contract.js";
import {presentAttackForecast} from "../../src/game/showdown/presenter.js";
import {applyAction, attackOf, canAttack, createShowdown, legalActions, opponent, playTurn} from "./rules.js";
import {BOUNTIES, DECK_SIZE, HUNTS, RIVALS, SIDE_SIZE, choose, deckProblems, duelFor, duelList, migrate, newSave, openPack, owned, settle, trailDone, withDeck} from "./progress.js";
import {logged, report} from "./playtest.js";
import {GRIT_CAP, TRAIL} from "./trail.js";
import {decodeSaveCode, describeSave, encodeSave, sameSave} from "./savecode.js";

const $ = (id) => document.getElementById(id);
const name = (cardId) => cardOf(cardId).name;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const sum = (counts) => Object.values(counts).reduce((total, copies) => total + copies, 0);
const orbs = (now, max) => `<span class="orbs" role="img" aria-label="${now} of ${Math.max(now, max)} orbs">${"●".repeat(now)}<span class="lost">${"○".repeat(Math.max(0, max - now))}</span></span>`;
// The same marks as the graybox card frames, plus gear and location.
const MARK = {troop: "●", spell: "✦", trap: "▲", gear: "◆", location: "■"};
const KIND = {spell: "Spell", trap: "Trap", gear: "Gear", location: "Location"};
const typeLine = (card) => `<span class="type">${MARK[card.kind]} ${card.kind === "troop" ? `Troop · ${card.tag}` : KIND[card.kind]} · ${RARITY[card.rarity][0]}</span>`;
const keywords = (card) => (card.keys ?? []).map((key) => `<span class="key" title="${KEYWORDS[key][1]}">${KEYWORDS[key][0]}</span>`).join(" ");
// A card's face. `full` spells out each keyword, for the moment a card is earned or chosen.
function face(type, {full = false, extra = ""} = {}) {
  const card = TYPES[type];
  const rules = card.kind !== "troop" ? EFFECTS[card.effect].text
    : full ? card.keys.map((key) => `<strong>${KEYWORDS[key][0]}.</strong> ${KEYWORDS[key][1]}`).join(" ") || "No keyword." : "";
  return `<strong>${card.name}</strong>${typeLine(card)}${card.kind === "troop" ? `${card.attack} attack · ${plural(card.health, "orb")} ${full ? "" : keywords(card)}` : ""}
    ${rules ? `<span class="note">${rules}</span>` : ""}${card.kind === "troop" ? `<span class="note">${costLine(type)}</span>` : ""}${extra}`;
}
// What a troop costs and when it can first attack, in words a newcomer has not had to learn yet.
function costLine(type) {
  const cost = tributes(`${type}-1`);
  if (cost) return `Cost: ${cost} of your troops, sent to the graveyard. Attacks the turn it arrives.`;
  return TYPES[type].keys.includes("quickdraw") ? "Cost: none." : "Cost: none. Rests the turn it arrives.";
}
const cardClass = (type) => `card cowboy ${TYPES[type].kind} ${TYPES[type].rarity}`;
const OFFER_HEADING = "Bonus: pick 1 more card to keep";
const offerRow = () => `<div class="row">${save.offer.map((type) =>
  `<button type="button" class="${cardClass(type)} earned can" data-choose="${type}">${face(type, {full: true, extra: `<span class="note">You own ${owned(save, type)}.</span>`})}</button>`).join("")}</div>`;

// ---- Saved progress -------------------------------------------------------------------------
const SAVE = "cvw-showdown-save-v2";
const OLD_SAVE = "cvw-showdown-trail-v1";
const stored = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
let save = migrate(stored(SAVE) ?? stored(OLD_SAVE));
function keep(next) {
  save = next;
  // Storage can be blocked or full: play on with the progress in memory, keep the last stored save, and say so.
  let saved = true;
  try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch { saved = false; }
  renderStorageNotice(saved);
  return saved;
}
// One notice above every screen, shown while the browser refuses to save.
function renderStorageNotice(saved) {
  let notice = document.getElementById("storage-notice");
  if (saved && !notice) return;
  if (!notice) {
    notice = Object.assign(document.createElement("p"), {id: "storage-notice", className: "note"});
    notice.setAttribute("role", "status");
    notice.dataset.testid = "storage-notice";
    $("camp").before(notice);
  }
  notice.hidden = saved;
  notice.textContent = saved ? "" : "This browser did not save your progress, so a reload will lose it. "
    + "To keep it, open Save code in the Camp and copy the code.";
}

// One line per finished duel against the Wizards, for the playtest report in the camp.
const LOG = "cvw-showdown-playtest-v1";
let log = Array.isArray(stored(LOG)) ? stored(LOG) : [];
function keepLog(next) {
  log = next;
  try { localStorage.setItem(LOG, JSON.stringify(log)); } catch { /* storage is blocked: the report covers this visit only */ }
}

// ---- What is on screen ----------------------------------------------------------------------
// A seed in the address fixes the first deal only; after that every duel is a fresh deal.
let fixedSeed = new URLSearchParams(location.search).get("seed");
const freshSeed = () => {
  const seed = fixedSeed === null ? Math.floor(Math.random() * 100000) : Number(fixedSeed);
  fixedSeed = null;
  return seed;
};
let screen = null;
let game; // {duel, players: 1 or 2, match: null or {wins, game, deck, side, first}, seed}
let state;
let lines; // log lines, oldest first
let pick; // nothing, a card (with tributes picked so far), or one of your troops
let outcome; // set once the game ends
let curtain = false; // two players: the screen is being passed
let opened = null; // the pack just opened, shown once in the camp
let draft; // the deck builder's working copy
let picked = null; // the card just taken from an offer, so the screen can confirm it

const solo = () => game.players === 1;
const me = () => (solo() ? "cowboy" : state.active);
const faction = (side) => (side === "cowboy" ? "Cowboy" : "Wizard");
const whose = (side) => (solo() ? (side === "cowboy" ? "Your" : "Enemy") : faction(side));
const baseOf = (side) => (solo() ? (side === "cowboy" ? "your Base" : "the Wizard Base") : `the ${faction(side)} Base`);

function show(next) {
  const visible = next === "duel" && curtain ? "curtain" : next;
  const moved = visible !== (screen === "duel" && !$("curtain").hidden ? "curtain" : screen);
  const first = screen === null; // the page has just opened: leave focus where the browser puts it
  const from = screen;
  screen = next;
  if (next !== "camp") closePreview();
  for (const id of ["camp", "builder", "duel", "curtain"]) $(id).hidden = id !== visible;
  if (visible === "camp") renderCamp();
  if (visible === "builder") renderBuilder();
  if (visible === "duel") renderDuel();
  if (visible === "curtain") $("curtain-text").textContent = `Pass the screen to the ${faction(state.active)} player.`;
  if (moved) window.scrollTo(0, 0);
  // Keyboard focus follows the screen instead of falling to the page behind a hidden control.
  if (moved && visible === "curtain") $("ready").focus();
  else if (moved && visible === "duel" && !$("end").hidden) $("end").focus({preventScroll: true});
  else if (moved && visible === "builder") ($("builder-rows").querySelector("button:not(:disabled)") ?? $("builder-save")).focus({preventScroll: true});
  else if (moved && visible === "camp" && from === "builder") $("build").focus({preventScroll: true}); // saved or cancelled: back where it opened
  else if (moved && visible === "camp" && !first) {
    // Back on the duel just left, or else the first control that can be used.
    const back = game && (game.players === 1 ? `[data-duel="${game.duel.id}"]` : "[data-two]");
    ($("camp").querySelector(`${back ?? "[data-duel]"}:not(:disabled)`) ?? $("camp").querySelector("button:not(:disabled)"))?.focus({preventScroll: true});
  }
}
// A live region rewritten with the same words can be read out again, so each one is written only when it changes.
const written = new WeakMap();
function write(el, value, as = "innerHTML") {
  if (written.get(el) === value) return;
  el[as] = value;
  written.set(el, value);
}
// The board and hand are redrawn after every move, which drops keyboard focus to the page. Put it back: on the
// first target when a pick wants one, else on the same control if it is still usable, else on the turn's button.
const focusKey = (el) => (el.id ? `#${el.id}` : ["card", "own", "enemy"].map((k) => el.dataset[k] !== undefined && `[data-${k}="${el.dataset[k]}"]`).find(Boolean));
function refocus(key) {
  const usable = (el) => el && !el.disabled && !el.hidden && el.getClientRects().length > 0;
  const target = pick ? $("board").querySelector("button.can") : null;
  const same = key ? $("duel").querySelector(key) : null;
  const next = [target, same, $("end"), $("again"), $("reward").querySelector("[data-again]")].find(usable);
  next?.focus();
}

// ---- Camp -----------------------------------------------------------------------------------
function renderCamp() {
  const list = duelList(save);
  // First things first: a card to choose, then a pack to open.
  const next = TRAIL[save.wins];
  const hint = picked ? `<p class="good">Added ${TYPES[picked].name}: you now own ${owned(save, picked)}. The new copy is not in your deck yet: use Build deck below.</p>` : "";
  $("claim").innerHTML = save.offer ? `<h2>${OFFER_HEADING}</h2><p class="note">You won. The one you pick goes into your collection.</p>${offerRow()}`
    : opened ? `<h2>In the pack</h2><div class="row">${opened.map((type) => `<div class="${cardClass(type)} earned">${face(type, {full: true})}</div>`).join("")}</div>
        <div class="row"><button type="button" id="pack-done">${save.packs ? `Open the next pack (${save.packs} left)` : "Add them to my collection"}</button></div>`
    : save.packs ? `${hint}<h2>${plural(save.packs, "pack")} to open</h2><div class="row"><button type="button" class="pack can" id="pack">Open a pack: three cards</button></div>`
    : `${hint}${next ? `<p id="next">${save.wins === 0 && !log.length ? "Start here" : "Next"}: click <strong>${next.name}</strong> to play ${save.wins === 0 ? "your first duel" : "it"}.</p>` : ""}`;

  // While a card is on offer nothing else can be started: the choice comes first.
  const tile = (duel, note, off = duel.state !== "open") => `<li><button type="button" class="tile ${duel.state}" ${off || save.offer ? "disabled" : `data-duel="${duel.id}"`}>
    <strong>${duel.state === "won" ? "✓ " : ""}${duel.name}</strong><span class="note">${note}</span></button></li>`;
  const pays = (cards) => cards.map(([type, copies]) => `${TYPES[type].name}${copies > 1 ? ` ×${copies}` : ""}`).join(", ");
  $("trail").innerHTML = list.filter((duel) => duel.kind === "trail").map((duel) => {
    const reward = pays(TRAIL[duel.index].reward.map(([type, , copies]) => [type, copies]));
    // A clean save is told where to begin; the open tile is already the one that is outlined.
    return tile(duel, duel.state === "won" ? `Earned ${reward}` : `Win to earn ${reward}`, undefined, duel.state === "open" && save.wins === 0 ? "Start here: your first duel." : "");
  }).join("");
  $("rivals").innerHTML = list.filter((duel) => duel.kind === "rival").map((duel, i) => {
    const rival = RIVALS[i];
    const reward = [pays(rival.reward.map((type) => [type, 1])), plural(rival.packs, "pack")].filter(Boolean).join(" and ");
    // A beaten rival can be fought again for the card choice.
    return tile(duel, duel.state === "won" ? "Beaten. Rematch for a card." : duel.state === "locked" ? (trailDone(save) ? "Beat the rival before" : "After the Trail") : `Win to earn ${reward}`, duel.state === "locked");
  }).join("");
  $("bounties").innerHTML = list.filter((duel) => duel.kind === "hunt").map((duel) => {
    const bounty = BOUNTIES.find((each) => `hunt:${each.id}` === duel.id);
    return tile(duel, duel.state === "won" ? `Captured: ${TYPES[bounty.reward].name}` : duel.state === "locked" ? "After the Trail"
      : `${duel.cleared} of ${HUNTS} hunts won. Five capture ${TYPES[bounty.reward].name}.`);
  }).join("");
  const open = trailDone(save) && !save.offer;
  $("open").innerHTML = `<button type="button" data-duel="open" ${open ? "" : "disabled"}>The even match${open ? "" : " (after the Trail)"}</button>
    <button type="button" data-match="open" ${open ? "" : "disabled"}>Best of three, with your side deck</button>
    <button type="button" data-two="1">Two players, one screen</button>
    <button type="button" data-two="3">Two players, best of three</button>`;
  const count = (counts) => Object.entries(counts).map(([type, copies]) => `${TYPES[type].name} ×${copies}`).join(", ");
  $("collection").innerHTML = `<strong>Deck:</strong> ${count(save.deck)}.${sum(save.side) ? ` <strong>Side deck:</strong> ${count(save.side)}.` : ""}
    <br><strong>Collection:</strong> Sheriff and Billy in any number${sum(save.collection) ? `, ${count(save.collection)}` : ""}.`;
  $("code").value = encodeSave(save);
  $("report").value = report(log, save);
}

// ---- Deck builder ---------------------------------------------------------------------------
// With a pool (between the games of a match) only the deck and side deck cards can be moved, and nothing is saved.
function openBuilder(pool, done) {
  const source = pool ? game.match : save;
  draft = {pool, done, deck: {...source.deck}, side: {...source.side}};
  show("builder");
}
const draftProblems = () => (!draft.pool ? deckProblems(save, draft.deck, draft.side)
  : sum(draft.deck) === DECK_SIZE ? [] : [`A deck is exactly ${DECK_SIZE} cards; this one has ${sum(draft.deck)}.`]);
function renderBuilder() {
  const types = Object.keys(TYPES).filter((type) => TYPES[type].side === "cowboy" && (draft.pool ? draft.pool[type] : owned(save, type) > 0));
  const limit = (type) => (draft.pool ? draft.pool[type] : Math.min(owned(save, type), RARITY[TYPES[type].rarity][1]));
  $("builder-title").textContent = draft.pool ? "Between games: swap with your side deck" : "Build deck";
  $("builder-note").textContent = draft.pool ? "Move cards between your deck and your side deck. The change lasts for this match."
    : `A deck is ${DECK_SIZE} cards. A side deck is up to ${SIDE_SIZE} more, to swap in between the games of a best of three.`;
  $("builder-rows").innerHTML = types.map((type) => {
    const [deck, side] = [draft.deck[type] ?? 0, draft.side[type] ?? 0];
    const room = deck + side < limit(type);
    const step = (zone, by, on, text) => `<button type="button" data-zone="${zone}" data-type="${type}" data-by="${by}" ${on ? "" : "disabled"} aria-label="${text} ${TYPES[type].name}">${by > 0 ? "+" : "−"}</button>`;
    // Between games a card moves from one pile to the other, so "+" on the deck takes it from the side deck.
    return `<div class="build-row"><div class="${cardClass(type)}">${face(type, {full: true})}</div>
      <div><span class="note">Deck</span>${step("deck", -1, deck > 0, "One fewer in the deck:")} <strong>${deck}</strong> ${step("deck", 1, draft.pool ? side > 0 : room, "One more in the deck:")}</div>
      <div><span class="note">Side deck</span>${step("side", -1, side > 0, "One fewer in the side deck:")} <strong>${side}</strong> ${step("side", 1, draft.pool ? deck > 0 : room, "One more in the side deck:")}</div>
      <span class="note">${Number.isFinite(limit(type)) ? `Limit: ${limit(type)} in deck and side deck together` : "Limit: none"}</span></div>`;
  }).join("");
  const problems = draftProblems();
  $("builder-problems").innerHTML = `Deck ${sum(draft.deck)} of ${DECK_SIZE} · side deck ${sum(draft.side)} of ${SIDE_SIZE}.${problems.length ? ` <span class="warn">${problems.join(" ")}</span>` : ""}`;
  $("builder-save").disabled = problems.length > 0;
  $("builder-save").textContent = draft.pool ? "Play the next game" : "Save deck";
  $("builder-cancel").hidden = Boolean(draft.pool);
}
function buildStep(zone, type, by) {
  const other = zone === "deck" ? "side" : "deck";
  draft[zone] = {...draft[zone], [type]: (draft[zone][type] ?? 0) + by};
  if (draft.pool) draft[other] = {...draft[other], [type]: (draft[other][type] ?? 0) - by};
  renderBuilder();
  // The rows are redrawn, which drops keyboard focus. Keep it on the same button so it can be pressed again; at a bound
  // (that button now disabled) move to the other button of the same pile, then the other pile, then Save.
  const button = (z, b) => $("builder-rows").querySelector(`[data-zone="${z}"][data-type="${type}"][data-by="${b}"]:not(:disabled)`);
  (button(zone, by) ?? button(zone, -by) ?? button(other, by) ?? button(other, -by) ?? $("builder-save")).focus();
}

// ---- Duel -----------------------------------------------------------------------------------
function say(events) {
  for (const e of events) {
    if (e.type === "turn") lines.push({turn: `Turn ${e.turn}: ${solo() ? (e.side === "cowboy" ? "you" : "the Wizards") : `the ${faction(e.side)}s`}`});
    else if (e.type === "tribute") lines.push({text: `${whose(e.side)} ${name(e.cardId)} was paid as tribute.`});
    else if (e.type === "summon") lines.push({text: `${whose(e.side)} ${name(e.cardId)} arrived.`});
    else if (e.type === "raise") lines.push({text: `Raise: ${whose(e.side).toLowerCase()} ${name(e.cardId)} returned from the graveyard with 1 orb.`});
    else if (e.type === "set") lines.push({text: solo() && e.side === "cowboy" ? "You set a trap face down." : `The ${faction(e.side)}s set a card face down.`});
    else if (e.type === "gear") lines.push({text: `${whose(e.side)} ${name(e.target)} now carries ${name(e.cardId)}.`});
    else if (e.type === "location") lines.push({text: `${whose(e.side)} ${name(e.cardId)} is now the location.`});
    else if (e.type === "cover") lines.push({text: `${whose(e.side)} ${name(e.cardId)} took cover.`});
    else if (e.type === "draw") lines.push({text: solo() ? (e.side === "cowboy" ? "You drew a card." : "The Wizards drew a card.") : `The ${faction(e.side)}s drew a card.`});
    else if (e.type === "burn") lines.push({text: `${whose(e.side)} hand was full (6 cards is the limit): ${name(e.cardId)} was discarded.`});
    else if (e.type === "fatigue") lines.push({text: `${whose(e.side)} deck is empty: ${baseOf(e.side)} lost 1 orb.`});
    else if (e.type === "spell") lines.push({text: `${whose(e.side)} ${name(e.cardId)} hit ${name(e.target)}: ${e.stunned ? "stunned for its next turn" : e.left === 0 ? "defeated" : `${plural(e.left, "orb")} left`}.`});
    else if (e.type === "trap") lines.push({text: `Trap! ${whose(e.side)} ${name(e.cardId)} caught ${name(e.target)}: ${cardOf(e.cardId).effect === "hex" ? "its attack was cancelled" : e.left === 0 ? "defeated before it struck" : `it dropped to ${e.left} and attacked anyway`}.`});
    else if (e.type === "laststand") lines.push({text: `Last Stand: ${name(e.cardId)} took an orb off ${name(e.target)}${e.left === 0 ? ", defeating it" : ""}.`});
    else if (e.type === "sweep") lines.push({text: `Sweep: ${name(e.cardId)} also hit ${plural(e.count, "other troop")} for 1.`});
    else if (e.type === "attack") {
      const base = baseOf(opponent(e.side));
      const result = e.target === "base" ? null
        : e.targetLeft === 0 ? `defeated it${e.baseDamage ? `, and ${e.baseDamage} went through to ${base}` : e.covered ? "; it was in cover, so nothing reached the Base" : ""}`
        : e.covered ? `left it on ${e.targetLeft}; it was in cover and did not hit back`
        : !e.hitBack ? `left it on ${e.targetLeft}; it has no attack, so it did not hit back`
        : `left it on ${e.targetLeft}, and it hit back for ${e.hitBack}${e.attackerLeft === 0 ? `, defeating ${name(e.cardId)}` : ""}`;
      lines.push({text: result ? `${whose(e.side)} ${name(e.cardId)} attacked ${name(e.target)} and ${result}.` : `${whose(e.side)} ${name(e.cardId)} struck ${base} for ${e.baseDamage}.`});
    }
  }
}

// Solo: the Wizards take their whole turn at once. Then, once the game is over, record it.
function advance() {
  while (solo() && !state.result && state.active === "wizard") {
    const played = playTurn(state, game.duel.level);
    state = played.state;
    say(played.events);
  }
  if (!state.result || outcome) return;
  const winner = state.result.winner;
  if (solo()) keepLog(logged(log, {name: game.duel.name, won: winner === "cowboy", turns: state.turn, seconds: Math.round((Date.now() - game.started) / 1000), rules: game.rules}));
  outcome = {winner, earned: null, matchOver: true};
  if (game.match) {
    if (winner) game.match.wins[winner] += 1;
    // The loser of a game opens the next one.
    game.match.first = winner ? opponent(winner) : state.first;
    outcome.matchOver = Math.max(...Object.values(game.match.wins)) >= 2;
  }
  // A duel against the Wizards counts once it is decided: after the game, or after the match.
  if (solo() && outcome.matchOver) {
    const won = game.match ? game.match.wins.cowboy >= 2 : winner === "cowboy";
    const settled = settle(save, game.duel.id, won);
    // Which of the cards just earned went straight into the deck, and what each replaced (the Trail swaps plain cards out).
    const swaps = game.duel.kind === "trail" && won ? TRAIL[save.wins].reward : [];
    const intoDeck = swaps.map(([type, replaced]) => [type, (settled.save.deck[type] ?? 0) - (save.deck[type] ?? 0), replaced]).filter(([, copies]) => copies > 0);
    Object.assign(outcome, {won, earned: settled.earned, intoDeck, grit: Math.min(settled.save.losses[game.duel.id] ?? 0, GRIT_CAP)});
    keep(settled.save);
  }
}

function act(action) {
  const before = state.active;
  const applied = applyAction(state, action);
  state = applied.state;
  say(applied.events);
  pick = null;
  advance();
  // Two players: hide the board while the screen changes hands.
  curtain = !solo() && !state.result && state.active !== before;
  show("duel");
}

// Starts a game of the current duel. The Cowboy deck is the saved one, or the match's own copy.
function deal() {
  const options = solo() ? duelFor(save, game.duel.id, game.match?.deck ?? save.deck).options : {decks: DECKS};
  state = createShowdown(game.seed, {...options, ...(game.match?.first ? {first: game.match.first} : {})});
  lines = [{turn: `Turn 1: ${solo() ? (state.active === "cowboy" ? "you" : "the Wizards") : `the ${faction(state.active)}s`}`}];
  pick = null;
  outcome = null;
  picked = null;
  Object.assign(game, {started: Date.now(), rules: false});
  advance();
  curtain = !solo();
  show("duel");
}
function startDuel(id, {players = 1, best = 1} = {}) {
  if (players === 1 && save.offer) return show("camp");
  const duel = players === 1 ? duelFor(save, id) : {id: "two", kind: "two", name: "Two players", lesson: "Two players on one screen, each with a starter deck. Pass the screen when the turn ends."};
  if (!duel) return;
  game = {duel, players, seed: freshSeed(), match: best > 1 ? {wins: {cowboy: 0, wizard: 0}, game: 1, deck: {...save.deck}, side: {...save.side}, first: null} : null};
  deal();
}
function nextGame() {
  game.seed = freshSeed();
  game.match.game += 1;
  // Solo, with a side deck: offer the swap before the next game.
  if (!solo() || !sum(game.match.side)) return deal();
  const pool = {};
  for (const counts of [game.match.deck, game.match.side]) for (const [type, copies] of Object.entries(counts)) pool[type] = (pool[type] ?? 0) + copies;
  openBuilder(pool, () => { Object.assign(game.match, {deck: draft.deck, side: draft.side}); deal(); });
}

const legal = () => legalActions(state);
const playsOf = (cardId) => legal().filter((a) => a.cardId && name(a.cardId) === name(cardId));

function clickCard(cardId) {
  const options = playsOf(cardId);
  // A trap, a location, an untargeted spell or a free troop has one way to be played.
  if (options.length === 1 && options[0].target === undefined && options[0].slot === undefined && !options[0].tributes?.length) return act(options[0]);
  pick = cardOf(cardId).kind === "troop" ? {card: cardId, tributes: []} : {card: cardId};
  renderDuel();
}
function clickOwn(slot) {
  if (pick?.tributes) {
    const paid = pick.tributes.includes(slot) ? pick.tributes.filter((s) => s !== slot) : [...pick.tributes, slot].sort();
    const done = playsOf(pick.card).find((a) => a.tributes.join() === paid.join());
    if (done) return act(done);
    pick = {...pick, tributes: paid};
  } else if (pick?.card) {
    const gear = playsOf(pick.card).find((a) => a.type === "gear" && a.slot === slot);
    if (gear) return act(gear);
  } else if (legal().some((a) => (a.type === "attack" || a.type === "cover") && a.slot === slot)) pick = {troop: slot};
  renderDuel();
}
function clickEnemy(target) {
  if (pick?.troop !== undefined) return act({type: "attack", slot: pick.troop, target});
  const cast = pick?.card && playsOf(pick.card).find((a) => a.target === target);
  if (cast) act(cast);
}

// Why a card in hand cannot be played right now, so a greyed card always says why.
function blocked(cardId) {
  const card = cardOf(cardId);
  if (state.attacking) return "No more cards this turn: a troop has acted.";
  if (card.kind === "troop") {
    if (state.summonUsed) return "One troop a turn.";
    const cost = tributes(cardId);
    return state.sides[me()].board.filter(Boolean).length < cost ? `Needs ${plural(cost, "troop")} of yours to pay with.` : "Your board is full.";
  }
  if (card.kind === "trap") return state.setUsed ? "One trap a turn." : "Both trap slots are full.";
  if (state.castUsed) return "One spell, gear or location a turn.";
  return card.kind === "location" ? "Already the location." : card.kind === "gear" ? "No troop to carry it." : "No target.";
}

// What an attack from the picked troop would do to this target, in words. Face-down traps are not counted.
function preview(view, target) {
  const {text, tone} = presentAttackForecast(view, pick.troop, target);
  return `<span class="note${tone ? ` ${tone}` : ""}">${text}</span>`;
}

// What the "again" button does next, in words.
function againLabel() {
  if (!state.result) return "Restart this duel";
  if (!outcome.matchOver) return `Game ${game.match.game + 1}`;
  if (!solo()) return "Play again";
  if (!outcome.won) return "Rematch";
  return game.duel.kind === "trail" || !duelFor(save, game.duel.id) ? "Back to camp" : "Play it again";
}
// Why one of your troops can take cover but not attack, in a few words (see canAttack in rules.js).
const whyResting = (troop) => state.turn === 1 ? "Opening turn" : troop.stunned ? "Stunned"
  : troop.arrived === state.turn && !troop.ready ? "Just arrived" : attackOf(state, troop) <= 0 ? "No attack" : "";

function renderDuel() {
  const focused = $("duel").contains(document.activeElement) ? focusKey(document.activeElement) : null;
  drawDuel();
  if (focused && !$("duel").hidden && !$("duel").contains(document.activeElement)) refocus(focused);
}
function drawDuel() {
  const mine = !state.result && (!solo() || state.active === "cowboy");
  const [own, foe] = [me(), opponent(me())];
  const attacking = pick?.troop !== undefined;
  const kind = pick?.card ? cardOf(pick.card).kind : null;
  const options = mine ? legal() : [];
  // Enemy troops and Base the current pick may be aimed at, and own troops a picked card may go on.
  const aims = new Set(attacking ? options.filter((a) => a.type === "attack" && a.slot === pick.troop).map((a) => a.target) : kind === "spell" ? playsOf(pick.card).map((a) => a.target) : []);
  const carriers = new Set(kind === "gear" ? playsOf(pick.card).map((a) => a.slot) : []);
  // The board is drawn from what this player may see, so the other hand, traps and both deck orders never reach the page.
  const view = viewFor(state, own);
  const shared = !solo() && Boolean(state.result);
  const row = (side) => {
    const s = view.sides[side];
    const isOwn = side === own;
    const baseOpen = !isOwn && aims.has("base");
    const traps = isOwn && !shared ? (s.traps.length ? `Set: ${s.traps.map(name).join(", ")}` : "No trap set") : s.trapCount ? `${plural(s.trapCount, "card")} face down` : "Nothing face down";
    const base = `<button type="button" class="base ${side}${baseOpen ? " can" : ""}" ${baseOpen ? 'data-enemy="base"' : "disabled"}>
      <strong>${solo() ? (isOwn ? "Your" : "Wizard") : faction(side)} Base</strong>${orbs(s.base, s.baseMax)}
      <span class="note">Hand ${s.handCount} · Deck ${s.deckCount} · Graveyard ${s.discard.length}</span>
      ${(isOwn ? s.traps.length || s.hand.some((id) => cardOf(id).kind === "trap") : s.trapCount) ? `<span class="note">▲ ${traps}</span>` : ""}${baseOpen ? preview(view, "base") : ""}</button>`;
    const slots = s.board.map((troop, slot) => {
      if (!troop) return `<button type="button" class="slot ${side}" disabled><span class="note">empty</span></button>`;
      const card = cardOf(troop.cardId);
      let cls = "", data = "disabled", note = troop.cover ? "In cover" : troop.stunned ? "Stunned" : "";
      if (isOwn && mine) {
        const tribute = pick?.tributes && playsOf(pick.card).some((a) => a.tributes.includes(slot));
        const ready = canAttack(state, troop);
        const actable = options.some((a) => (a.type === "attack" || a.type === "cover") && a.slot === slot);
        if (tribute) { cls = pick.tributes.includes(slot) ? " chosen" : " can"; data = `data-own="${slot}"`; note = "Tribute"; }
        else if (carriers.has(slot)) { cls = " can"; data = `data-own="${slot}"`; note = "Give it the gear"; }
        else if (pick?.troop === slot) { cls = " pick"; note = ready ? "Choose a target, or take cover" : "It can take cover"; }
        else if (!pick && actable) { cls = " can"; data = `data-own="${slot}"`; note = ready ? "Can attack" : [whyResting(troop), "can take cover"].filter(Boolean).join(" · ").replace(/^c/, "C"); }
        else if (troop.attacked && !troop.cover) note = "Has attacked";
      } else if (!isOwn && aims.has(slot)) {
        cls = " can"; data = `data-enemy="${slot}"`;
        if (kind === "spell") note = cardOf(pick.card).effect === "tie" ? "Would be stunned" : troop.health === 1 ? "Would be defeated" : `Would drop to ${troop.health - 1}`;
      }
      const attack = attackOf(state, troop);
      return `<button type="button" class="slot ${side}${cls}" ${data}><strong>${card.name}</strong><span class="type">${MARK.troop} Troop · ${card.tag}</span>
        ${attack} attack${attack !== card.attack ? ` (+${attack - card.attack})` : ""} ${orbs(troop.health, card.health)} ${keywords(card)}
        ${troop.gear.length ? `<span class="note">◆ ${troop.gear.map(name).join(", ")}</span>` : ""}${note ? `<span class="note">${note}</span>` : ""}${!isOwn && attacking && aims.has(slot) ? preview(view, slot) : ""}</button>`;
    }).join("");
    return `<div class="side">${base}${slots}</div>`;
  };
  $("board").innerHTML = row(foe) + row(own);
  const landing = state.arrivals.map((due) => `${TYPES[due.type].name} lands at the start of turn ${Math.max(due.turn, state.turn + (state.active === due.side ? 2 : 1))}.`).join(" ");
  $("location").textContent = landing + (landing && state.location ? " " : "") + (state.location ? `■ Location: ${name(state.location.cardId)} (${whose(state.location.side).toLowerCase()}). ${EFFECTS[cardOf(state.location.cardId).effect].text.replace("Location. ", "")}` : "");

  const playable = new Set(options.filter((a) => a.cardId).map((a) => name(a.cardId)));
  $("hand").innerHTML = (shared ? [] : view.sides[own].hand).map((cardId) => {
    const card = cardOf(cardId);
    const on = playable.has(card.name);
    return `<button type="button" class="card ${card.side} ${card.kind} ${card.rarity}${pick?.card === cardId ? " pick" : on ? " can" : ""}" data-card="${cardId}" ${on ? "" : "disabled"}>
      ${face(cardId.replace(/-\d+$/, ""), {extra: mine && !on ? `<span class="note warn">${blocked(cardId)}</span>` : ""})}</button>`;
  }).join("");

  const r = state.result;
  const match = game.match;
  const score = match ? ` · game ${match.game} of 3 · ${solo() ? `you ${match.wins.cowboy}, Wizards ${match.wins.wizard}` : `Cowboys ${match.wins.cowboy}, Wizards ${match.wins.wizard}`}` : "";
  const verdict = !r ? "" : r.winner === null ? "Draw." : solo() ? (r.winner === "cowboy" ? "You win: the Wizard Base fell." : "You lose: your Base fell.") : `The ${faction(r.winner)}s win: ${baseOf(opponent(r.winner))} fell.`;
  write($("status"), r ? `<span class="result ${!solo() || r.winner === "cowboy" ? "good" : "warn"}">${verdict}</span>${score}`
    : `${game.duel.name}${score} · turn ${state.turn} · ${solo() ? "your turn" : `the ${faction(state.active)}s' turn`}`);

  // After a win: what it paid, then the two cards to choose from. After a loss: what the rematch gives.
  // Each part has its own box, so taking a card changes (and announces) only the choice.
  const earned = outcome?.earned;
  // A game inside a match and a two-player game pay nothing, but they still need the button that moves on.
  const moveOn = `<div class="row"><button type="button" class="can" data-again="1">${state.result ? againLabel() : ""}</button></div>`;
  const parts = !outcome ? [] : !earned ? [moveOn] : [
    earned.captured ? `<h2>Captured</h2><div class="row"><div class="${cardClass(earned.captured)} earned">${face(earned.captured, {full: true})}</div></div>` : "",
    earned.cards.length ? `<h2>New in your collection</h2><div class="row">${earned.cards.map(([type, copies]) => `<div class="${cardClass(type)} earned">${face(type, {full: true, extra: copies > 1 ? `<span class="note">×${copies}</span>` : ""})}</div>`).join("")}</div>` : "",
    earned.packs ? `<p class="good">You earned ${plural(earned.packs, "pack")}. Open ${earned.packs > 1 ? "them" : "it"} in camp.</p>` : "",
    outcome.intoDeck.length ? `<p class="note">In your deck now: ${outcome.intoDeck.map(([type, copies, replaced]) => `${TYPES[type].name} ×${copies} in place of ${TYPES[replaced].name} ×${copies}`).join(", ")}.</p>` : "",
    earned.cards.length && !outcome.intoDeck.length ? `<p class="note">${earned.cards.length > 1 ? "They are" : "It is"} in your collection, not your deck yet: use Build deck in camp.</p>` : "",
    // The offer and the line that confirms the choice share one part, so choosing rewrites only that part.
    outcome.won && save.offer ? `<h2>${OFFER_HEADING}</h2>${offerRow()}`
      : picked ? `<p class="good">Added ${TYPES[picked].name}: you now own ${owned(save, picked)}. The new copy is not in your deck yet: use Build deck in camp.</p>` : "",
    !outcome.won && outcome.grit ? `<p class="note">Grit: your Base starts the rematch with ${5 + outcome.grit} orbs.</p>` : "",
    moveOn,
  ];
  // Each part has its own box, so taking a card changes (and announces) only the choice.
  const boxes = [...$("reward").children];
  parts.forEach((html, i) => write(boxes[i] ?? $("reward").appendChild(document.createElement("div")), html));
  boxes.slice(parts.length).forEach((box) => box.remove());

  const canCover = attacking && options.some((a) => a.type === "cover" && a.slot === pick.troop);
  const guarded = state.sides[foe].board.some((troop) => troop && cardOf(troop.cardId).keys.includes("guard"));
  write($("prompt"), r ? "" : pick?.tributes ? `Choose ${tributes(pick.card)} of your troops to send to the graveyard as payment for ${name(pick.card)}.`
    : kind === "gear" ? `Choose one of your troops to carry ${name(pick.card)}.`
    : kind === "spell" ? `Choose an enemy troop for ${name(pick.card)}.`
    : attacking ? `${aims.size === 0 ? "This troop cannot attack now." : guarded ? "A Guard stands in the way: attack it first." : aims.has("base") && aims.size === 1 ? "No enemy troops: strike the Base." : "Choose what to attack."}${
      canCover ? " Or take cover: until your next turn it keeps extra damage off your Base, but it will not hit back." : ""}`
    : state.attacking ? "No more cards this turn. Act with your other troops, or end the turn."
    : state.turn === 1 ? "Play your cards: one troop a turn. Nobody attacks on the opening turn."
    : "First play cards (one troop, one other card). Then act with your troops. Once a troop acts, no more cards this turn.", "textContent");
  $("end").hidden = Boolean(r);
  $("end").disabled = !mine;
  $("cover").hidden = !canCover;
  $("cancel").hidden = !pick;
  // After a result the button that moves on sits under the reward; the row here keeps only "Back to camp".
  $("again").hidden = Boolean(r);
  $("again").textContent = againLabel();
  $("lesson").textContent = game.duel.lesson;
  $("log").innerHTML = lines.map((l) => (l.turn ? `<li class="turn">${l.turn}</li>` : `<li>${l.text}</li>`)).join("");
  $("log").scrollTop = $("log").scrollHeight;
  for (const side of ["cowboy", "wizard"]) $(`${side}-graveyard`).textContent = state.sides[side].discard.map(name).join(", ") || "empty";
  // Only the keywords on cards in this duel, so a new player reads a short list.
  // This list names keywords, never cards, and both decks are known lists, so reading the whole state here shows nothing hidden.
  const cards = ["cowboy", "wizard"].flatMap((side) => [...state.sides[side].hand, ...state.sides[side].deck, ...state.sides[side].discard, ...state.sides[side].board.filter(Boolean).map((troop) => troop.cardId)]);
  const inPlay = new Set(cards.flatMap((cardId) => cardOf(cardId).keys ?? []));
  $("keywords").innerHTML = Object.entries(KEYWORDS).filter(([key]) => inPlay.has(key)).map(([, [word, rule]]) => `<li><strong>${word}.</strong> ${rule}</li>`).join("")
    || "<li>No keywords in this duel yet.</li>";
}

// ---- Clicks ---------------------------------------------------------------------------------
document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b || b.disabled) return;
  const d = b.dataset;
  if (d.choose) {
    // The offer is redrawn away, so focus moves on: to the button that moves on in the duel, else to what Camp offers next.
    picked = d.choose;
    keep(choose(save, d.choose));
    show(screen);
    (screen === "duel" ? $("reward").querySelector("[data-again]") : $("claim").querySelector("button") ?? $("camp").querySelector("[data-duel]:not(:disabled)"))?.focus();
  }
  else if (d.again) again();
  else if (d.duel) startDuel(d.duel);
  else if (d.match) startDuel(d.match, {best: 3});
  else if (d.two) startDuel("two", {players: 2, best: Number(d.two)});
  else if (d.zone) buildStep(d.zone, d.type, Number(d.by));
  else if (d.card) clickCard(d.card);
  else if (d.own) clickOwn(Number(d.own));
  else if (d.enemy) clickEnemy(d.enemy === "base" ? "base" : Number(d.enemy));
  else if (b.id === "pack" || (b.id === "pack-done" && save.packs)) { const pack = openPack(save); opened = pack.cards; keep(pack.save); renderCamp(); }
  else if (b.id === "pack-done") { opened = null; renderCamp(); }
});
$("build").addEventListener("click", () => openBuilder(null, () => { keep(withDeck(save, draft.deck, draft.side)); show("camp"); }));
$("builder-save").addEventListener("click", () => draft.done());
$("builder-cancel").addEventListener("click", () => show("camp"));
$("end").addEventListener("click", () => act({type: "end"}));
$("cover").addEventListener("click", () => act({type: "cover", slot: pick.troop}));
$("cancel").addEventListener("click", () => { pick = null; renderDuel(); });
$("ready").addEventListener("click", () => { curtain = false; show("duel"); });
$("leave").addEventListener("click", () => { curtain = false; show("camp"); });
$("build").addEventListener("click", () => { picked = null; });
// Before a result this replays the same deal. After one it is the next game, the rematch, or the way back.
function again() {
  if (!state.result) return deal();
  if (!outcome.matchOver) return nextGame();
  if (!solo()) return startDuel("two", {players: 2, best: game.match ? 3 : 1});
  // A Trail win moves on, and a finished bounty is gone: go back to camp to see what opened.
  if (outcome.won && (game.duel.kind === "trail" || !duelFor(save, game.duel.id))) return show("camp");
  startDuel(game.duel.id, {best: game.match ? 3 : 1});
}
$("again").addEventListener("click", again);
// A pasted code is read strictly, and a different save replaces this one only after Replace is pressed.
// The preview belongs to the exact text it was read from: any edit withdraws it, and Replace re-checks the text.
let pending = null;
function closePreview() { pending = null; $("code-preview").hidden = true; }
$("code").addEventListener("input", () => {
  if (!pending) return;
  closePreview();
  $("code-note").textContent = "The code changed, so the preview was closed. Press Load to preview it. Nothing was changed.";
});
$("load").addEventListener("click", () => {
  closePreview();
  const read = decodeSaveCode($("code").value);
  if (!read.ok) { $("code-note").textContent = `${read.reason} Nothing was changed.`; return; }
  if (sameSave(read.save, save)) { $("code-note").textContent = "That code is the progress you already have. Nothing was changed."; return; }
  pending = {save: read.save, text: $("code").value};
  $("code-preview-text").textContent = `This code${read.legacy ? " (from an older version)" : ""} holds: ${describeSave(read.save)} You have: ${describeSave(save)} Replace your progress in this browser with it?`;
  $("code-preview").hidden = false;
  $("code-note").textContent = "";
  $("code-cancel").focus();
});
$("code-cancel").addEventListener("click", () => { closePreview(); $("code-note").textContent = "Cancelled. Nothing was changed."; $("load").focus(); });
$("code-replace").addEventListener("click", () => {
  if (!pending) return;
  const {save: next, text} = pending;
  closePreview();
  if ($("code").value !== text) { $("code-note").textContent = "The code changed, so the preview was closed. Press Load to preview it. Nothing was changed."; return; }
  const saved = keep(next); opened = picked = null; renderCamp();
  $("code-note").textContent = saved ? "Loaded." : "Loaded for this visit only: the browser did not save it.";
  $("load").focus();
});
$("rules").addEventListener("toggle", () => { if ($("rules").open && game) game.rules = true; });
$("reset").addEventListener("click", () => {
  if (!confirm("Start over? Your cards, progress and playtest report in this browser are erased.")) return;
  closePreview();
  keep(newSave());
  keepLog([]);
  opened = picked = null;
  renderCamp();
  $("code-note").textContent = "Started over.";
});
show("camp");
