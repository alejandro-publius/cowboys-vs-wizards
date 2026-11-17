import {COWBOY_CATALOG, DEFAULT_COUNTS, validateDeck} from '../game/deck-builder.js';

const MAX_COPIES = 6;
const element = (tag, text, attrs = {}) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
const costOf = card => card.kind === 'spell' ? 'Spell · no tribute' : card.stars < 5 ? 'Free summon' : card.stars < 7 ? '1 tribute' : '2 tributes';
const statsOf = card => card.kind === 'spell' ? 'Removes 1 enemy orb' : `${card.attack} attack · ${card.health} life`;
const ruleOf = card => card.kind === 'spell'
  ? 'Remove 1 life orb from an enemy troop. Summon first if you want to do both this turn.'
  : card.stars < 5
    ? `Troop with ${card.attack} attack and ${card.health} life. Summon it free, with no tribute.`
    : `Troop with ${card.attack} attack and ${card.health} life. Summon it by choosing ${card.stars < 7 ? '1 friendly troop' : '2 friendly troops'} as tribute first.`;

// Collection + chosen-deck workbench. Uses the approved card art as CSS backgrounds
// (.deck-art), the existing validation and profile.saveDeck; no new rules.
export function renderDeckWorkbench({content, profile, say, savedMessage, button}) {
  const stored = profile.get().deck;
  let counts = {...(stored && validateDeck(stored).ok ? stored : DEFAULT_COUNTS)};
  let selected = COWBOY_CATALOG[0].type;
  const count = type => counts[type] ?? 0;

  content.append(element('p', 'Pick a card to read it. Build exactly 12 cards, up to 6 copies of each, with at least 1 Sheriff.', {class: 'menu-intro'}));
  const layout = element('div', undefined, {class: 'workbench'});
  const collection = element('section', undefined, {class: 'wb-panel wb-collection', 'aria-labelledby': 'wb-collection-title'});
  collection.append(element('h3', 'Card collection', {id: 'wb-collection-title'}));
  const grid = element('div', undefined, {class: 'deck-grid', role: 'group', 'aria-label': 'Cowboy cards'});
  const detail = element('section', undefined, {class: 'wb-panel wb-detail', 'aria-live': 'polite', 'aria-label': 'Selected card'});
  const chosen = element('section', undefined, {class: 'wb-panel wb-chosen', 'aria-labelledby': 'wb-chosen-title'});
  chosen.append(element('h3', 'Your deck', {id: 'wb-chosen-title'}));
  const total = element('p', '', {class: 'deck-total'});
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
  for (const card of COWBOY_CATALOG) {
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
    const result = validateDeck(counts);
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
  actions.append(save, reset);
  chosen.append(total, rows, validation, actions, feedback);
  collection.append(grid);
  layout.append(collection, detail, chosen);
  content.append(layout);

  function refresh() {
    const result = validateDeck(counts);
    total.textContent = `${result.total} / 12 cards`;
    total.dataset.ready = String(result.ok);
    validation.textContent = result.ok ? 'Ready to save.' : result.error;
    validation.dataset.ok = String(result.ok);
    save.disabled = !result.ok;
    for (const card of COWBOY_CATALOG) {
      const n = count(card.type), tile = tiles.get(card.type), r = deckRows.get(card.type);
      tile.setAttribute('aria-pressed', String(card.type === selected));
      tile.setAttribute('aria-label', `Select ${card.name}, ${n} in deck`);
      tile.querySelector('.deck-badge').textContent = `${n} in deck`;
      r.quantity.textContent = n;
      r.row.dataset.selected = String(card.type === selected);
      r.row.dataset.empty = String(n === 0);
      r.minus.disabled = n === 0;
      r.plus.disabled = n >= MAX_COPIES || result.total >= 12;
    }
    const card = COWBOY_CATALOG.find(c => c.type === selected), n = count(selected);
    detail.replaceChildren(
      element('h3', card.name),
      element('p', `${costOf(card)} · ${statsOf(card)}`, {class: 'detail-line'}),
      element('p', ruleOf(card), {class: 'detail-rule'}),
      element('p', `${n} of up to ${MAX_COPIES} in your deck.`, {class: 'detail-line'}));
  }
  refresh();
}
