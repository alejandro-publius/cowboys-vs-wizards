import {frameOf, typeLine} from './card-frames.js';
import {BOUNTY_REWARDS, COWBOY_CATALOG, DECK_SIZE, DEFAULT_COUNTS, FRONTIER_CATALOG, copyLimit, deckIds, validateDeck} from '../game/deck-builder.js';
import {BILLY_POSSE, DEADEYE_CONTROL, DRAGON_POSSE, FRONTIER_UNLOCKS, IMP_NAME, NIGHT_RIDERS, STARGAZER_NAME, STARGAZER_WINS, WAGON_TRAIN, WRAITH_POSSE, frontierUnlocked} from '../game/deck-presets.js';
import {CARDS, MAX_COWBOY_COPIES, tributeCost} from '../game/cards.js';
import {isFree, openingDroughtRate} from '../game/opening-policy.js';
import {createMatch} from '../game/state.js';
import {earnedRewards} from '../game/bounty-hunt.js';

const element = (tag, text, attrs = {}) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
const costOf = card => card.kind === 'spell' ? 'Spell · no tribute' : tributeCost(card.stars) === 0 ? 'Free summon' : tributeCost(card.stars) === 1 ? '1 tribute' : '2 tributes';
const statsOf = card => card.kind === 'spell' ? 'Removes 1 enemy orb' : `${card.attack} attack · ${card.health} life`;
const ruleOf = card => card.kind === 'spell'
  ? 'Remove 1 life orb from an enemy troop. Summon first if you want to do both this turn.'
  : tributeCost(card.stars) === 0
    ? `Troop with ${card.attack} attack and ${card.health} life. Summon it free, with no tribute.`
    : `Troop with ${card.attack} attack and ${card.health} life. Summon it by choosing ${tributeCost(card.stars) === 1 ? '1 friendly troop' : '2 friendly troops'} as tribute first.`;

// Collection + chosen-deck workbench. Uses the approved card art as CSS backgrounds
// (.deck-art), the existing validation and profile.saveDeck; no new rules.
// `presets` comes from the graybox title-screen marker and adds Load Deadeye Control
// and Load Billy Posse. Optional `tryDraft(counts, opener, opponent)` adds Try draft, which
// plays a copy of the current legal draft and leaves the saved deck unchanged.
export function renderDeckWorkbench({content, profile, say, savedMessage, button, presets = false, tryDraft, draft = null, trialOpponent = null, bounties = false}) {
  const saved = profile.get();
  const wins = Number(saved?.stats?.wins) || 0;
  // Each Wanted reward joins the collection only after its own boss is cleared.
  // Frontier cards (zero starter copies) join the collection at their win counts.
  const frontierCards = frontierUnlocked(saved);
  const entitlement = {rewards: bounties ? earnedRewards(saved) : [], frontierCards};
  const collectionCards = [...COWBOY_CATALOG,
    ...BOUNTY_REWARDS.filter(card => entitlement.rewards.includes(card.type)),
    ...FRONTIER_CATALOG.filter(card => frontierCards.includes(card.type))];
  const stored = saved.deck;
  // Baseline: the recipe Play uses, i.e. the latest legal saved deck or the
  // starter. Only Save deck moves it; loading, restoring and Try draft do not.
  const savedLegal = Boolean(stored && validateDeck(stored, entitlement).ok);
  let baseline = {...(savedLegal ? stored : DEFAULT_COUNTS)};
  let baselineSaved = savedLegal;
  const initial = draft && validateDeck(draft, entitlement).ok ? draft : baseline;
  let counts = {...initial};
  let selected = collectionCards[0].type;
  const count = type => counts[type] ?? 0;
  // Compare actual card counts: an omitted type and an explicit 0 are the same.
  const isDirty = () => [...new Set([...Object.keys(counts), ...Object.keys(baseline)])]
    .some(type => (counts[type] ?? 0) !== (baseline[type] ?? 0));

  content.append(element('p', `Pick a card to read it. Build exactly ${DECK_SIZE} cards, up to ${MAX_COWBOY_COPIES} copies of most cards (each card shows its own limit), with at least 1 Sheriff.`, {class: 'menu-intro'}));
  const layout = element('div', undefined, {class: 'workbench'});
  const collection = element('section', undefined, {class: 'wb-panel wb-collection', 'aria-labelledby': 'wb-collection-title'});
  collection.append(element('h3', 'Card collection', {id: 'wb-collection-title'}));
  const grid = element('div', undefined, {class: 'deck-grid', role: 'group', 'aria-label': 'Cowboy cards'});
  const detail = element('section', undefined, {class: 'wb-panel wb-detail', 'aria-live': 'polite', 'aria-label': 'Selected card'});
  const chosen = element('section', undefined, {class: 'wb-panel wb-chosen', 'aria-labelledby': 'wb-chosen-title'});
  chosen.append(element('h3', 'Your deck', {id: 'wb-chosen-title'}));
  const total = element('p', '', {class: 'deck-total'});
  const openingOdds = element('p', '', {class: 'detail-line'});
  // Optional opening-hand preview: the Cowboy's first four cards from the
  // existing createMatch deal. The seed stays put while the draft is edited.
  let previewSeed = 0;
  const preview = element('details', undefined, {class: 'wb-preview'});
  const previewHand = element('ul', undefined, {class: 'deck-rows', 'aria-label': 'Opening hand preview'});
  const previewInfo = element('p', '', {class: 'detail-line', role: 'status'});
  const previewHelp = element('p', '', {class: 'detail-line'});
  const previewDeal = button('Deal another opening', () => {previewSeed += 1; refresh();}, {id: 'preview-deal'});
  preview.append(element('summary', 'Preview opening hand'), previewHelp, previewInfo, previewHand, previewDeal);
  const rows = element('ul', undefined, {class: 'deck-rows'});
  const validation = element('p', '', {class: 'deck-validation', role: 'status'});
  const feedback = element('p', '', {class: 'deck-feedback', role: 'status'});
  const playState = element('p', '', {class: 'detail-line', id: 'wb-play-state'});

  const tiles = new Map(), deckRows = new Map();
  function change(type, delta) {
    counts[type] = count(type) + delta;
    selected = type;
    feedback.textContent = '';
    refresh();
  }
  for (const card of collectionCards) {
    const tile = element('button', undefined, {type: 'button', class: 'deck-choice', 'data-card': card.type, 'data-frame': frameOf(card)});
    tile.append(
      element('span', undefined, {class: 'deck-art', 'data-card-type': card.type, role: 'img', 'aria-label': card.name + ' illustrated card'}),
      element('span', card.name, {class: 'deck-name'}),
      element('span', typeLine(frameOf(card)), {class: 'plain-card-type'}),
      element('span', costOf(card), {class: 'deck-cost'}),
      element('span', '', {class: 'deck-badge'}));
    tile.addEventListener('click', () => {selected = card.type; refresh();});
    grid.append(tile);
    tiles.set(card.type, tile);

    const row = element('li', undefined, {class: 'deck-row', 'data-card': card.type});
    const name = element('button', card.name, {type: 'button', class: 'deck-row-name'});
    name.addEventListener('click', () => {selected = card.type; refresh();});
    const minus = button('−', () => change(card.type, -1), {'aria-label': 'Remove ' + card.name, class: 'step'});
    const quantity = element('output', '', {'aria-label': card.name + ' copies', class: 'deck-count'});
    const plus = button('+', () => change(card.type, 1), {'aria-label': 'Add ' + card.name, class: 'step'});
    row.append(name, minus, quantity, plus);
    rows.append(row);
    deckRows.set(card.type, {row, quantity, minus, plus});
  }

  const save = button('Save deck', () => {
    const result = validateDeck(counts, entitlement);
    if (!result.ok) {say(result.error); feedback.textContent = result.error; return;}
    const after = profile.saveDeck(counts);
    baseline = {...(after.deck ?? counts)};
    baselineSaved = true;
    refresh();
    const msg = profile.isPersistent() ? 'Deck saved. Your next match will use these cards.' : 'Saved for this session only. Browser storage is unavailable.';
    savedMessage('Deck saved. Your next match will use these cards.');
    feedback.textContent = msg;
  }, {id: 'save-deck'});
  const reset = button('Restore starter deck', () => {
    counts = {...DEFAULT_COUNTS};
    refresh();
    say('Starter deck restored. Choose Save deck to keep it.');
    feedback.textContent = 'Starter deck restored. Choose Save deck to keep it.';
  });
  // Reverts the draft to the baseline in memory only; nothing is written to the profile.
  const revert = button('Revert changes', () => {
    counts = {...baseline};
    refresh();
    // Revert disables itself; keep keyboard focus in the action row.
    save.focus();
    const msg = baselineSaved ? 'Changes reverted to your saved deck.' : 'Changes reverted to the starter deck.';
    say(msg);
    feedback.textContent = msg;
  }, {id: 'revert-deck', 'aria-describedby': 'wb-play-state'});
  const actions = element('div', undefined, {class: 'menu-actions'});
  actions.append(save, revert);
  const notes = [];
  let trial = null, opponentSelect = null;
  if (tryDraft) {
    trial = button('Try draft', async () => {
      const result = validateDeck(counts, entitlement);
      if (!result.ok) {say(result.error); feedback.textContent = result.error; refresh(); return;}
      feedback.textContent = '';
      await tryDraft({...counts}, trial, opponentSelect?.value || null);
      refresh();
    }, {id: 'try-draft', 'aria-describedby': 'wb-try-summary'});
    if (wins >= STARGAZER_WINS) {
      opponentSelect = element('select', undefined, {id: 'try-draft-opponent'});
      for (const [value, label] of [['', 'Default Wizard'], ['stargazer', STARGAZER_NAME], ['imp', IMP_NAME]]) {
        opponentSelect.append(element('option', label, {value}));
      }
      opponentSelect.value = ['stargazer', 'imp'].includes(trialOpponent) ? trialOpponent : '';
      const field = element('label', 'Trial opponent ', {for: 'try-draft-opponent', class: 'detail-line'});
      field.append(opponentSelect);
      actions.append(field);
    }
    actions.append(trial);
    notes.push(element('p', 'Play a trial duel with this draft. Your saved deck is kept.', {id: 'wb-try-summary', class: 'detail-line'}));
  }
  actions.append(reset);
  if (presets) {
    // Loading replaces only this unsaved draft. The saved profile deck and the
    // current match stay as they are until Save deck.
    actions.append(button(`Load ${DEADEYE_CONTROL.name}`, () => {
      counts = {...DEADEYE_CONTROL.counts};
      refresh();
      feedback.textContent = `${DEADEYE_CONTROL.name} draft loaded. Save deck to use it in your next match.`;
    }, {id: 'load-deadeye-control', 'aria-describedby': 'wb-preset-summary'}));
    notes.push(element('p', 'Adds one Deadeye in place of Mounted Billy, the two-tribute finisher.', {id: 'wb-preset-summary', class: 'detail-line'}));
    actions.append(button(`Load ${BILLY_POSSE.name}`, () => {
      counts = {...BILLY_POSSE.counts};
      refresh();
      feedback.textContent = `${BILLY_POSSE.name} draft loaded. Save deck to use it in your next match.`;
    }, {id: 'load-billy-posse', 'aria-describedby': 'wb-billy-posse-summary'}));
    notes.push(element('p', 'Billy Posse: hold or pressure lanes with Sheriffs, then trade one Sheriff as tribute for Billy to strengthen that lane. A fourth Billy replaces Mounted Billy.', {id: 'wb-billy-posse-summary', class: 'detail-line'}));
  }
  // Frontier lists appear once every card in them is earned. Loading replaces
  // only the draft, like the other presets.
  for (const [preset, id, text] of [
    [WAGON_TRAIN, 'load-wagon-train', 'Wagon Train: hold lanes behind Covered Wagons, clear with Lasso and Deadeyes, then tribute two troops for the Gatling Crew.'],
    [NIGHT_RIDERS, 'load-night-riders', 'Night Riders: seven free troops, Dynamiter bursts and riders that change lanes. No two-tribute card.'],
  ]) {
    if (wins < preset.wins) continue;
    actions.append(button(`Load ${preset.name}`, () => {
      counts = {...preset.counts};
      refresh();
      feedback.textContent = `${preset.name} draft loaded. Try the draft or save it for your next duel.`;
    }, {id, 'aria-describedby': `${id}-summary`}));
    notes.push(element('p', text, {id: `${id}-summary`, class: 'detail-line'}));
  }
  if (entitlement.rewards.includes("cowboy-captured-wraith")) {
    actions.append(button("Load Wraith Posse", () => {
      counts = {...WRAITH_POSSE};
      selected = "cowboy-captured-wraith";
      refresh();
      feedback.textContent = "Wraith Posse loaded. Try the draft or save it for your next duel.";
    }, {id: "load-wraith-posse"}));
  }
  if (entitlement.rewards.includes("cowboy-captured-dragon")) {
    actions.append(button("Load Dragon Posse", () => {
      counts = {...DRAGON_POSSE};
      selected = "cowboy-captured-dragon";
      refresh();
      feedback.textContent = "Dragon Posse loaded. Try the draft or save it for your next duel.";
    }, {id: "load-dragon-posse"}));
  }
  // Next Frontier reward from FRONTIER_UNLOCKS, named from the catalog.
  const nextUnlock = FRONTIER_UNLOCKS.find(unlock => wins < unlock.wins);
  let frontierText = `All ${FRONTIER_UNLOCKS.length} Frontier cards earned.`;
  if (nextUnlock) {
    const name = FRONTIER_CATALOG.find(card => card.type === nextUnlock.type)?.name ?? nextUnlock.type;
    const left = nextUnlock.wins - wins;
    frontierText = `Next Frontier card: ${name} in ${left} counted duel ${left === 1 ? 'win' : 'wins'} (${frontierCards.length} of ${FRONTIER_UNLOCKS.length} earned).`;
  }
  const frontierLine = element('p', frontierText, {class: 'detail-line'});
  chosen.append(frontierLine, total, openingOdds, preview, playState, rows, validation, actions, ...notes, feedback);
  if (draft) feedback.textContent = 'Your trial draft is back. Save deck to keep it, or Revert changes.';
  collection.append(grid);
  layout.append(collection, detail, chosen);
  content.append(layout);

  function refresh() {
    const result = validateDeck(counts, entitlement);
    total.textContent = `${result.total} / ${DECK_SIZE} cards`;
    total.dataset.ready = String(result.ok);
    openingOdds.hidden = !result.ok;
    if (result.ok) {
      const rate = (100 * openingDroughtRate(deckIds(counts, entitlement))).toFixed(1);
      openingOdds.textContent = `${rate}% chance of no free summon in a standard opening hand.`;
    }
    previewDeal.disabled = !result.ok;
    previewHand.hidden = previewInfo.hidden = !result.ok;
    if (result.ok) {
      const hand = createMatch(previewSeed, {cowboyDeck: deckIds(counts, entitlement)}).sides.cowboy.hand;
      const free = hand.filter(isFree).length;
      previewHelp.textContent = 'Your first four cards from this draft. Nothing is saved.';
      previewInfo.textContent = `Seed ${previewSeed} · ${free} free ${free === 1 ? 'troop' : 'troops'}${free === 0 ? ' · No free summon in this opening.' : ''}`;
      previewHand.replaceChildren(...hand.map(id => element('li', CARDS[id].name, {class: 'deck-row'})));
    } else {
      previewHelp.textContent = `Finish a legal ${DECK_SIZE}-card deck to preview an opening.`;
      previewHand.replaceChildren();
    }
    validation.textContent = result.ok ? 'Ready to save.' : result.error;
    validation.dataset.ok = String(result.ok);
    save.disabled = !result.ok;
    if (trial) trial.disabled = !result.ok;
    const dirty = isDirty(), source = baselineSaved ? 'saved deck' : 'starter deck';
    playState.textContent = dirty
      ? `Unsaved changes. Play still uses your ${source}.`
      : `Matches your ${source}. Play uses these cards.`;
    playState.dataset.dirty = String(dirty);
    revert.disabled = !dirty;
    for (const card of collectionCards) {
      const n = count(card.type), tile = tiles.get(card.type), r = deckRows.get(card.type);
      tile.setAttribute('aria-pressed', String(card.type === selected));
      tile.setAttribute('aria-label', `Select ${card.name}, ${n} in deck`);
      tile.querySelector('.deck-badge').textContent = `${n} in deck`;
      r.quantity.textContent = n;
      r.row.dataset.selected = String(card.type === selected);
      r.row.dataset.empty = String(n === 0);
      r.minus.disabled = n === 0;
      r.plus.disabled = n >= copyLimit(card) || result.total >= DECK_SIZE;
    }
    const card = collectionCards.find(c => c.type === selected), n = count(selected);
    detail.replaceChildren(
      element('h3', card.name),
      element('p', `${costOf(card)} · ${statsOf(card)}`, {class: 'detail-line'}),
      element('p', ruleOf(card)
        + (card.rides ? ' Ride: instead of summoning, move this troop one lane into an empty lane of yours.' : '')
        + (card.relocates ? ' If it survives, you may drag it one lane into an empty lane.' : ''), {class: 'detail-rule'}),
      element('p', `${n} of up to ${copyLimit(card)} in your deck.`, {class: 'detail-line'}));
  }
  refresh();
}
