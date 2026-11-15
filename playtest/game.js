import { CARDS, SIDES, tributeCost } from '../src/game/cards.js';
import { createMatch, BASE_ORBS, MAX_ROUNDS, SLOT_COUNT } from '../src/game/state.js';
import { applyAction } from '../src/game/actions.js';
import { legalActions } from '../src/game/legal.js';
import { publicState } from '../src/game/view.js';
import { chooseAction } from '../src/game/cpu.js';
import { createBounty } from './bounty.js';
import { createBoard } from './board.js';
import artwork from './board-layout.json';

const get = id => document.getElementById(id);
const arena = get('arena');
const hand = get('hand');
const fx = get('fx');
const human = 'cowboy';
const enemy = 'wizard';
const laneNames = ['West', 'Center', 'East'];
const emblems = { Sheriff: '✶', Billy: '✦', 'Mounted Billy': '♞', Deadeye: '◎', Skeleton: '♱', Wizard: '✧', Dragon: '♜' };
const baseName = { cowboy: 'Saloon', wizard: 'Rune Gate' };
const actorName = { cowboy: 'You', wizard: 'Wizard' };
const cueColor = { cowboy: '#ffc06e', wizard: '#cc8eff' };
const DEFAULT_SEED = 6;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

let state, shown, board, session, mode, pending;
let busy = false;
let statusText = '';

const slots = Object.fromEntries(SIDES.map(side => [side, []]));
for (const side of SIDES) {
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lane';
    button.dataset.side = side;
    button.dataset.slot = String(slot);
    button.onclick = () => selectLane(side, slot);
    slots[side].push(button);
    get('lanes').append(button);
  }
}

function pictureSize() {
  const scale = Math.min(arena.clientWidth / artwork.width, arena.clientHeight / artwork.height);
  return { width: artwork.width * scale, height: artwork.height * scale };
}

function point(side, slot, lift = 0) {
  if (board) return board.point(side, slot, lift);
  const {width, height} = pictureSize();
  const tile = artwork.slots[side][slot];
  const [x, y] = slot === null ? artwork.bases[side] : tile.base.map((v, i) => v + (tile.head[i] - v) * lift);
  return { x: (arena.clientWidth - width) / 2 + x * width, y: (arena.clientHeight - height) / 2 + y * height };
}

function placeLanes() {
  const picture = pictureSize();
  arena.style.setProperty('--lane-width', `${(board ? arena.clientWidth : picture.width) * .148}px`);
  arena.style.setProperty('--lane-height', `${(board ? arena.clientHeight : picture.height) * .193}px`);
  for (const side of SIDES) {
    slots[side].forEach((button, slot) => {
      const { x, y } = point(side, slot);
      button.style.setProperty('--x', `${x}px`);
      button.style.setProperty('--y', `${y}px`);
      const figure = button.dataset.unit === 'Billy' || button.dataset.unit === 'Wizard';
      const spriteHeight = picture.height * (figure ? .216 : .095);
      const orbOffset = board ? point(side, slot, figure ? 1.87 : 1.19).y - y : -(spriteHeight + 4);
      button.style.setProperty('--piece-height', `${spriteHeight}px`);
      button.style.setProperty('--orb-offset', `${orbOffset}px`);
    });
  }
}

function orbs(health, limit) {
  const row = document.createElement('span');
  row.className = 'orb-row';
  row.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < limit; i++) {
    const orb = document.createElement('i');
    orb.className = i < health ? 'orb lit' : 'orb';
    row.append(orb);
  }
  return row;
}

function availableActions() {
  return !busy && shown.activeSide === human ? legalActions(shown, human) : [];
}

function choices(actions) {
  if (!pending) return null;
  const variants = actions.filter(action => action.cardId === pending.cardId);
  const card = CARDS[pending.cardId];
  if (card.kind === 'spell') {
    return {
      side: enemy, kind: 'target', candidates: new Set(variants.map(a => a.target)),
      action: variants.find(a => a.target === pending.slot),
    };
  }

  const cost = tributeCost(card.stars);
  const sets = variants.filter(a => pending.tributes.every(slot => a.tributes.includes(slot)));
  if (pending.tributes.length < cost) {
    return {
      side: human, kind: 'tribute', remaining: cost - pending.tributes.length,
      candidates: new Set(sets.flatMap(a => a.tributes).filter(i => !pending.tributes.includes(i))),
    };
  }
  return {
    side: human, kind: 'destination', candidates: new Set(sets.map(a => a.slot)),
    action: sets.find(a => a.slot === pending.slot),
  };
}

function selectLane(side, slot) {
  const choice = choices(availableActions());
  if (!choice || choice.side !== side || !choice.candidates.has(slot)) return;
  if (choice.kind === 'tribute') pending.tributes.push(slot);
  else pending.slot = slot;
  render();
}

function selectCard(cardId) {
  if (!availableActions().some(action => action.cardId === cardId)) return;
  pending = pending?.cardId === cardId ? null : { cardId, tributes: [], slot: null };
  render();
}

function renderHand(actions) {
  const { hand: cards, deckCount } = shown.sides[human];
  const playable = new Set(actions.map(a => a.cardId));
  const activeId = document.activeElement?.dataset.cardId;
  const scroll = hand.scrollLeft;
  hand.replaceChildren(...cards.map(id => {
    const card = CARDS[id];
    const troop = card.kind === 'troop';
    const cost = troop ? tributeCost(card.stars) : 0;
    const button = document.createElement('button');
    button.className = 'card';
    button.type = 'button';
    button.dataset.cardId = id;
    button.dataset.spell = String(!troop);
    button.dataset.unit = card.name;
    button.disabled = !playable.has(id);
    button.setAttribute('aria-pressed', String(pending?.cardId === id));
    button.onclick = () => selectCard(id);
    const lines = [
      ['card-emblem', emblems[card.name]],
      ['card-name', card.name],
      ['card-tier', troop ? `${card.stars}★ · ${cost ? `${cost} tribute` : 'Free summon'}` : 'Spell'],
      ['card-stat', troop ? `${card.attack} ATK · ${card.health} orbs` : 'Remove 1 enemy orb'],
    ];
    for (const [name, value] of lines) {
      const line = document.createElement('span');
      line.className = name;
      line.textContent = value;
      if (name === 'card-emblem') line.setAttribute('aria-hidden', 'true');
      button.append(line);
    }
    return button;
  }));
  hand.scrollLeft = scroll;
  if (activeId) [...hand.children].find(button => button.dataset.cardId === activeId)?.focus({preventScroll:true});
  get('hand-count').textContent = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`;
  get('deck-count').textContent = `${deckCount} in deck`;
}

function renderLanes(choice) {
  for (const side of SIDES) {
    const { board: troops, baseOrbs } = shown.sides[side];
    get(`${side}-orbs`).replaceChildren(orbs(baseOrbs, BASE_ORBS));
    get(`${side}-orbs`).setAttribute('aria-label', `${baseOrbs} of ${BASE_ORBS} base orbs`);
    slots[side].forEach((button, slot) => {
      const troop = troops[slot];
      const card = troop && CARDS[troop.cardId];
      const legal = choice?.side === side && choice.candidates.has(slot);
      const marked = pending && ((side === human && pending.tributes.includes(slot)) || (choice?.side === side && pending.slot === slot));
      button.dataset.unit = card?.name ?? '';
      button.disabled = !legal;
      button.classList.toggle('is-legal', legal);
      button.classList.toggle('is-marked', Boolean(marked));
      button.classList.toggle('is-empty', !troop);
      button.setAttribute('aria-label', `${side === human ? 'Your' : 'Wizard'} ${laneNames[slot].toLowerCase()} lane${troop ? `, ${card.name}, ${troop.health} ${troop.health === 1 ? 'orb' : 'orbs'}` : ', empty'}`);
      const tag = document.createElement('span');
      tag.className = 'lane-tag';
      tag.textContent = card ? card.name : laneNames[slot];
      const marker = document.createElement('span');
      marker.className = 'lane-marker';
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = card ? emblems[card.name] : '';
      button.replaceChildren(marker, tag);
      if (troop?.health > 0) {
        const row = orbs(troop.health, troop.health);
        row.classList.add('unit-orbs');
        button.append(row);
      }
    });
  }
}

function render() {
  const actions = availableActions();
  const choice = choices(actions);
  const selected = pending && CARDS[pending.cardId];
  const outcome = shown.result;
  const wizard = shown.sides[enemy];
  const message = busy ? statusText || 'Let the current move resolve.'
    : outcome ? `Final score ${shown.sides[human].baseOrbs} to ${wizard.baseOrbs}.`
    : choice?.kind === 'tribute' ? `Select ${choice.remaining} friendly ${choice.remaining === 1 ? 'troop' : 'troops'} to sacrifice.`
    : choice?.action ? 'Confirm to play this card.'
    : choice?.kind === 'target' ? 'Choose a highlighted enemy troop.'
    : choice ? 'Choose a highlighted lane.'
    : actions.some(a => a.cardId) ? 'Select a card to see where it can be played.'
    : 'End your turn to continue.';

  get('round').textContent = `Round ${shown.round} / ${MAX_ROUNDS}`;
  get('wizard-counts').textContent = `${wizard.handCount} in hand · ${wizard.deckCount} in deck`;
  get('turn').textContent = busy ? 'Resolving' : outcome ? 'Match complete' : 'Your turn';
  get('action-title').textContent = outcome ? 'Duel complete' : selected ? selected.name : busy ? 'The duel continues' : 'Choose your move';
  if (get('instruction').textContent !== message) get('instruction').textContent = message;
  get('confirm').hidden = !selected;
  get('confirm').disabled = !choice?.action;
  get('confirm').textContent = selected?.kind === 'spell' ? 'Cast spell' : 'Summon';
  get('cancel').hidden = !pending;
  get('end').hidden = Boolean(pending);
  get('end').disabled = !actions.some(a => a.type === 'end-phase');
  get('seed').textContent = `Seed ${state.seed}`;
  get('objective').hidden = mode !== 'bounty';
  get('duel-mode').setAttribute('aria-pressed', String(mode === 'duel'));
  get('bounty-mode').setAttribute('aria-pressed', String(mode === 'bounty'));
  get('restart').textContent = mode === 'bounty' ? 'Retry bounty' : 'New duel';

  renderHand(actions);
  renderLanes(choice);
  placeLanes();
  get('outcome').hidden = !outcome;
  if (outcome) {
    get('result-title').textContent = outcome.outcome === 'win' ? (mode === 'bounty' ? 'Bounty cleared' : 'Victory') : outcome.outcome === 'draw' ? 'Draw' : 'Defeat';
    get('result-detail').textContent = `${baseName[human]} ${shown.sides[human].baseOrbs} · ${baseName[enemy]} ${wizard.baseOrbs}`;
    get('again').textContent = get('restart').textContent;
  }
}

function log(message) {
  const item = document.createElement('li');
  item.textContent = message;
  const list = get('log');
  list.prepend(item);
  if (list.childElementCount > 5) list.lastElementChild.remove();
}

function wait(ms, signal) {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise(resolve => {
    const id = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve(true);
    }, ms);
    function abort() {
      clearTimeout(id);
      resolve(false);
    }
    signal.addEventListener('abort', abort, { once: true });
  });
}

function effect(className, position, color, frames, duration, label) {
  if (reduced.matches) return;
  const el = document.createElement('span');
  el.className = className;
  el.style.left = `${position.x}px`;
  el.style.top = `${position.y}px`;
  el.style.setProperty('--cue', color);
  if (label) el.textContent = label;
  fx.append(el);
  const animation = el.animate(frames, { duration, easing: 'ease-out' });
  animation.onfinish = () => el.remove();
}

function targetPoint(target) {
  return point(target.side, target.kind === 'base' ? null : target.slot, target.kind === 'base' ? 0 : .73);
}

function fire(from, to, side, duration) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const rotate = `rotate(${Math.atan2(dy, dx)}rad)`;
  effect(`bolt${side === enemy ? ' magic' : ''}`, from, cueColor[side], [
    { transform: rotate, opacity: .35 },
    { transform: `translate(${dx}px,${dy}px) ${rotate}`, opacity: 1 },
  ], duration);
}

function impact(target, amount, color) {
  const position = targetPoint(target);
  effect('impact', position, color, [{ transform:'scale(.35)', opacity:1 }, { transform:'scale(2.25)', opacity:0 }], 320);
  if (amount > 0) effect('float-text', position, color, [
    { transform:'translate(-50%,-60%)', opacity:1 },
    { transform:'translate(-50%,-160%)', opacity:0 },
  ], 460, `−${amount}`);
}

function applyImpact(event) {
  const { target, before, after } = event;
  if (target.kind === 'base') shown.sides[target.side].baseOrbs = after;
  else shown.sides[target.side].board[target.slot].health = after;
  impact(target, before - after, cueColor[event.attacker?.side ?? event.caster]);
}

async function play(action, signal) {
  const result = applyAction(state, { ...action, actionId: `playtest-${state.revision}` });
  if (!result.ok) throw new Error(`Move rejected (${result.reason}).`);
  state = result.state;
  const events = result.events;
  const first = events[0];
  const clash = events.find(event => event.type === 'clash');
  const shotMs = reduced.matches ? 35 : 275;

  if (first.type === 'summon') {
    const name = CARDS[first.cardId].name;
    log(`${actorName[first.side]} summoned ${name}${first.tributes.length ? ` with ${first.tributes.length} tribute` : ''}.`);
  }
  if (first.type === 'spell') {
    statusText = `${actorName[first.caster]} cast ${first.spell}.`;
    log(statusText);
    render();
    fire(point(first.caster, null), targetPoint(first.target), first.caster, shotMs);
    if (!await wait(shotMs, signal)) return;
    applyImpact(first);
    render();
    if (!await wait(reduced.matches ? 20 : 210, signal)) return;
    if (first.destination !== undefined) log(`${first.spell} moved ${CARDS[first.target.cardId].name} to the ${laneNames[first.destination].toLowerCase()} lane.`);
  }
  if (clash) {
    const hits = events.filter(event => event.type === 'damage');
    statusText = `Round ${clash.round} clash. All occupied lanes attack.`;
    log(statusText);
    render();
    for (const hit of hits) fire(point(hit.attacker.side, hit.attacker.slot, .92), targetPoint(hit.target), hit.attacker.side, shotMs);
    if (!await wait(shotMs, signal)) return;
    // Apply all reported impact values before removing any defeated piece.
    for (const hit of hits) applyImpact(hit);
    render();
    if (!await wait(reduced.matches ? 20 : 250, signal)) return;
    if (state.sides[human].baseOrbs !== shown.sides[human].baseOrbs) throw new Error('Clash display disagrees with the engine.');
    if (state.round !== clash.round) log(`Round ${state.round}. Both sides draw a card if their deck has one.`);
  }

  shown = publicState(state, human);
  board?.update(shown);
  render();
  if (first.type === 'summon') {
    const drop = { side: first.side, slot: first.slot };
    impact(drop, 0, cueColor[first.side]);
    await wait(reduced.matches ? 20 : 180, signal);
  }
}

async function advance(action = null) {
  if (busy) return;
  const signal = session.signal;
  busy = true;
  pending = null;
  statusText = '';
  render();
  try {
    if (action) await play(action, signal);
    while (!signal.aborted && state.activeSide === enemy) {
      statusText = 'The Wizard is choosing a move.';
      render();
      if (!await wait(reduced.matches ? 35 : 250, signal)) return;
      const cpuAction = chooseAction(publicState(state, enemy));
      if (!cpuAction) throw new Error('The Wizard has no legal action.');
      await play(cpuAction, signal);
    }
  } catch (error) {
    if (!signal.aborted) {
      shown = publicState(state, human);
      board?.update(shown);
      log(error.message);
      console.error(error);
    }
  } finally {
    if (!signal.aborted) {
      busy = false;
      render();
    }
  }
}

function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function begin(nextMode, seed = newSeed()) {
  const start = nextMode === 'bounty' ? createBounty() : createMatch(seed);
  session?.abort();
  session = new AbortController();
  mode = nextMode;
  state = start;
  shown = publicState(state, human);
  busy = false;
  pending = null;
  fx.replaceChildren();
  get('log').replaceChildren();
  log(mode === 'bounty' ? 'Final clash. The Wizard has already acted.' : 'Four cards dealt. Your Saloon starts with five orbs.');
  board?.update(shown);
  render();
  if (state.activeSide === enemy) void advance();
}

get('duel-mode').onclick = () => { if (mode !== 'duel') begin('duel', DEFAULT_SEED); };
get('bounty-mode').onclick = () => { if (mode !== 'bounty') begin('bounty'); };
get('restart').onclick = get('again').onclick = () => begin(mode);
get('replay').onclick = () => begin(mode, state.seed);
get('cancel').onclick = () => { pending = null; render(); };
get('confirm').onclick = () => { const action = choices(availableActions())?.action; if (action) void advance(action); };
get('end').onclick = () => { const action = availableActions().find(a => a.type === 'end-phase'); if (action) void advance(action); };
document.addEventListener('keydown', event => { if (event.key === 'Escape' && pending) get('cancel').click(); });
new ResizeObserver(placeLanes).observe(arena);
const params = new URLSearchParams(location.search);
const seed = params.get('seed');
begin(params.get('mode') === 'bounty' ? 'bounty' : 'duel', /^\d+$/.test(seed ?? '') && Number(seed) <= 0xffff_ffff ? Number(seed) : DEFAULT_SEED);

const modelData = get('models');
// If WebGL is unavailable the same buttons, rules and effects run on a 2D board.
createBoard(get('canvas'), JSON.parse(modelData.textContent), placeLanes, () => {
  board = null;
  arena.classList.remove('has-3d');
  placeLanes();
}).then(result => {
  board = result;
  arena.classList.add('has-3d');
  board.update(shown);
  placeLanes();
  renderLanes(choices(availableActions()));
}).catch(error => {
  console.info('Playing in 2D:', error.message);
});
modelData.remove();
