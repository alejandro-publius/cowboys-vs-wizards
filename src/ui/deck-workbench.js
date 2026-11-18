import {BOUNTY_REWARDS, COWBOY_CATALOG, DECK_SIZE, DEFAULT_COUNTS, copyLimit, deckIds, validateDeck} from '../game/deck-builder.js';
import {BILLY_POSSE, DEADEYE_CONTROL} from '../game/deck-presets.js';
import {MAX_COWBOY_COPIES, tributeCost} from '../game/cards.js';
import {openingDroughtRate} from '../game/opening-policy.js';
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
// and Load Billy Posse. Optional `tryDraft(counts, opener)` adds Try draft, which
// plays a copy of the current legal draft and leaves the saved deck unchanged.
export function renderDeckWorkbench({content, profile, say, savedMessage, button, presets = false, tryDraft, bounties = false}) {
  const saved = profile.get();
  // Each Wanted reward joins the collection only after its own boss is cleared.
  const entitlement = {rewards: bounties ? earnedRewards(saved) : []};
  const collectionCards = [...COWBOY_CATALOG, ...BOUNTY_REWARDS.filter(card => entitlement.rewards.includes(card.type))];
  const stored = saved.deck;
  let counts = {...(stored && validateDeck(stored, entitlement).ok ? stored : DEFAULT_COUNTS)};
  let selected = COWBOY_CATALOG[0].type;
  const count = type => counts[type] ?? 0;

  content.append(element('p', `Pick a card to read it. Build exactly ${DECK_SIZE} cards, up to ${MAX_COWBOY_COPIES} copies of each, with at least 1 Sheriff.`, {class: 'menu-intro'}));
  const layout = element('div', undefined, {class: 'workbench'});
  const collection = element('section', undefined, {class: 'wb-panel wb-collection', 'aria-labelledby': 'wb-collection-title'});
  collection.append(element('h3', 'Card collection', {id: 'wb-collection-title'}));
  const grid = element('div', undefined, {class: 'deck-grid', role: 'group', 'aria-label': 'Cowboy cards'});
  const detail = element('section', undefined, {class: 'wb-panel wb-detail', 'aria-live': 'polite', 'aria-label': 'Selected card'});
  const chosen = element('section', undefined, {class: 'wb-panel wb-chosen', 'aria-labelledby': 'wb-chosen-title'});
  chosen.append(element('h3', 'Your deck', {id: 'wb-chosen-title'}));
  const total = element('p', '', {class: 'deck-total'});
  const openingOdds = element('p', '', {class: 'detail-line'});
  const rows = element('ul', undefined, {class: 'deck-rows'});
  const validation = element('p', '', {class: 'deck-validation', role: 'status'});
  const feedback = element('p', '', {class: 'deck-feedback', role: 'status'});

  const tiles = new Map(), deckRows = new Map();
  function change(type, delta) {
    counts[type] = count(type) + delta;
    selected = type;
    feedback.textContent = '';
    refresh();
  }
  for (const card of collectionCards) {
    const tile = element('button', undefined, {type: 'button', class: 'deck-choice', 'data-card': card.type});
    tile.append(
      element('span', undefined, {class: 'deck-art', 'data-card-type': card.type, role: 'img', 'aria-label': card.name + ' illustrated card'}),
      element('span', card.name, {class: 'deck-name'}),
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
    profile.saveDeck(counts);
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
  const actions = element('div', undefined, {class: 'menu-actions'});
  actions.append(save);
  const notes = [];
  let trial = null;
  if (tryDraft) {
    trial = button('Try draft', async () => {
      const result = validateDeck(counts, entitlement);
      if (!result.ok) {say(result.error); feedback.textContent = result.error; refresh(); return;}
      feedback.textContent = '';
      await tryDraft({...counts}, trial);
      refresh();
    }, {id: 'try-draft', 'aria-describedby': 'wb-try-summary'});
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
  if (entitlement.rewards.includes("cowboy-captured-wraith")) {
    actions.append(button("Load Wraith Posse", () => {
      counts = {...DEFAULT_COUNTS, "cowboy-sheriff": DEFAULT_COUNTS["cowboy-sheriff"] - 1, "cowboy-captured-wraith": 1};
      selected = "cowboy-captured-wraith";
      refresh();
      feedback.textContent = "Wraith Posse loaded. Try the draft or save it for your next duel.";
    }, {id: "load-wraith-posse"}));
  }
  if (entitlement.rewards.includes("cowboy-captured-dragon")) {
    actions.append(button("Load Dragon Posse", () => {
      counts = {...DEFAULT_COUNTS, "cowboy-mounted-billy": 0, "cowboy-captured-dragon": 1};
      selected = "cowboy-captured-dragon";
      refresh();
      feedback.textContent = "Dragon Posse loaded. Try the draft or save it for your next duel.";
    }, {id: "load-dragon-posse"}));
  }
  chosen.append(total, openingOdds, rows, validation, actions, ...notes, feedback);
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
    validation.textContent = result.ok ? 'Ready to save.' : result.error;
    validation.dataset.ok = String(result.ok);
    save.disabled = !result.ok;
    if (trial) trial.disabled = !result.ok;
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
      element('p', ruleOf(card), {class: 'detail-rule'}),
      element('p', `${n} of up to ${copyLimit(card)} in your deck.`, {class: 'detail-line'}));
  }
  refresh();
}
