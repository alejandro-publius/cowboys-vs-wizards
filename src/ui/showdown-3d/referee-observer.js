// Referee browser audit: what the illustrated Showdown page visibly shows, read from the page alone.
// No engine, session or contract import: this file must stay self-contained, because
// scripts/referee/browser.mjs strips the `export` keywords and injects the source into the page
// (window.__refereeObserver). The game build does not import it.
//
// Every field the page does not show is listed in `incomplete` with the reason, never guessed.

export const FACTION_SIDE = {Cowboys: "cowboy", Wizards: "wizard", Cowboy: "cowboy", Wizard: "wizard"};

// "3 of 5 orbs" (the aria-label of .sd-orbs on a Base or a troop).
export function parseOrbs(label) {
  const m = /^(\d+) of (\d+) orbs$/.exec(String(label ?? "").trim());
  return m ? {now: Number(m[1]), max: Number(m[2])} : null;
}

// "Hand 4 · Deck 17 · Graveyard 0" (the first note on a Base button).
export function parseBaseNote(text) {
  const m = /Hand (\d+) · Deck (\d+) · Graveyard (\d+)/.exec(String(text ?? ""));
  return m ? {hand: Number(m[1]), deck: Number(m[2]), graveyard: Number(m[3])} : null;
}

// The trap note: own seat "Set: A, B" or "No trap set"; other seat "2 cards face down" or "Nothing face down".
export function parseTraps(text) {
  const t = String(text ?? "").replace(/^▲\s*/, "").trim();
  if (t === "No trap set") return {count: 0, names: []};
  if (t === "Nothing face down") return {count: 0, names: null};
  const set = /^Set: (.+)$/.exec(t);
  if (set) {
    const names = set[1].split(", ");
    return {count: names.length, names};
  }
  const down = /^(\d+) cards? face down$/.exec(t);
  return down ? {count: Number(down[1]), names: null} : null;
}

// #sd-status in a two-player duel: "Two players · turn 3 · the Wizards' turn", or the verdict.
export function parseStatus(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  const out = {turn: null, active: null, result: null};
  const turn = /\bturn (\d+)\b/.exec(t);
  if (turn) out.turn = Number(turn[1]);
  const active = /the (Cowboys|Wizards)' turn/.exec(t);
  if (active) out.active = FACTION_SIDE[active[1]];
  if (/^Draw\./.test(t)) out.result = {winner: null, reason: null};
  const win = /The (Cowboys|Wizards) win: the (Cowboy|Wizard) Base fell\./.exec(t);
  if (win) out.result = {winner: FACTION_SIDE[win[1]], reason: "base-fell"};
  return out;
}

// "Pass the screen to the Wizard player."
export function parseCurtain(text) {
  const m = /Pass the screen to the (Cowboy|Wizard) player\./.exec(String(text ?? ""));
  return {next: m ? FACTION_SIDE[m[1]] : null};
}

// "■ Location: Saloon Row. …" in #sd-location (arrival notes may come first).
export function parseLocation(text) {
  const m = /■ Location: ([^.]+)\./.exec(String(text ?? ""));
  return m ? m[1].trim() : null;
}

export function parseGraveyard(text) {
  const t = String(text ?? "").trim();
  return !t || t === "empty" ? [] : t.split(", ");
}

// Compact zones carry their public counts even when the zero label is hidden.
export function parseWorldLabel(text, {zoneTitle, zoneCount, zoneMax} = {}) {
  if (zoneTitle) {
    const label = {title: zoneTitle, count: zoneCount ? Number(zoneCount) : null};
    if (zoneMax) label.of = Number(zoneMax);
    return label;
  }
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  const traps = /^Traps (\d+)\/(\d+)$/.exec(t);
  if (traps) return {title: "Traps", count: Number(traps[1]), of: Number(traps[2])};
  const counted = /^(.*\S) (\d+)$/.exec(t);
  return counted ? {title: counted[1], count: Number(counted[2])} : {title: t, count: null};
}

// Fields of the normalized referee state that no public element of this page shows. Recorded on every
// observation so the report counts them as incomplete instead of silently passing.
export const UNOBSERVABLE = [
  ["troop.instanceId", "board slots show the printed name only; no instance id or copy suffix is visible"],
  ["discard.instanceIds", "graveyards list printed names only"],
  ["discard.order", "graveyard text order is not documented as discard order"],
  ["location.owner", "#sd-location names the location but not who played it"],
  ["allowances.summonCastSet", "summonUsed, castUsed and setUsed show only as notes on disabled hand cards of the active seat"],
  ["troop.rest.otherSeat", "rest, attacked and ready notes appear only on the active seat's own troops"],
  ["deck.order", "hidden by design: deck contents are counts only"],
  ["hand.otherSeat.identities", "hidden by design: the other seat's hand is card backs"],
  ["traps.otherSeat.identities", "hidden by design: the other seat's traps are a face-down count"],
  ["trap.slotIndex", "own traps are a name list, not numbered trap slots"],
  ["result.reason.draw", "a draw shows 'Draw.' with no reason"],
  ["inactiveSeat.presentation", "two players on one screen show only the active seat; the other seat is seen at its next turn"],
];

// The whole visible table. doc and win default to the page's own.
export function observeTable(doc, win) {
  doc = doc ?? document;
  win = win ?? window;
  const text = (node) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
  const shown = (node) => {
    if (!node || node.hidden || node.closest?.("[hidden]")) return false;
    if (!node.getClientRects().length) return false;
    const style = win.getComputedStyle(node);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0;
  };
  const incomplete = UNOBSERVABLE.map(([field, reason]) => ({field, reason}));
  const obs = {screenShown: shown(doc.getElementById("showdown")), curtain: null, status: null, viewer: null,
    sides: {}, hand: [], controls: null, prompt: null, location: null, graveyards: {}, world: null, incomplete};

  const curtain = doc.getElementById("sd-curtain");
  if (curtain && !curtain.hidden) {
    obs.curtain = parseCurtain(text(doc.getElementById("sd-curtain-text")));
    obs.curtain.readyShown = shown(doc.getElementById("sd-ready"));
    obs.world = observeWorld(doc, win, incomplete, shown, text);
    return obs;
  }

  obs.status = {text: text(doc.getElementById("sd-status")), ...parseStatus(text(doc.getElementById("sd-status")))};
  const rows = [...doc.querySelectorAll("#sd-board .sd-side")];
  // The screen draws the other seat first and the viewing seat last.
  obs.viewer = rows.at(-1)?.dataset.side ?? null;
  if (!rows.length) incomplete.push({field: "board", reason: "#sd-board has no .sd-side rows"});
  for (const row of rows) {
    const side = row.dataset.side;
    const base = row.querySelector(`.sd-base[data-base="${side}"]`);
    const notes = [...(base?.querySelectorAll(".sd-note") ?? [])].map(text);
    const backs = base?.querySelector(".sd-backs");
    const entry = {
      base: parseOrbs(base?.querySelector(".sd-orbs")?.getAttribute("aria-label")),
      counts: parseBaseNote(notes.find((n) => n.startsWith("Hand ")) ?? ""),
      traps: parseTraps(notes.find((n) => n.startsWith("▲")) ?? ""),
      backs: backs ? backs.querySelectorAll(".card-back").length : null,
      baseTargetable: base?.dataset.enemy === "base" && !base.disabled,
      slots: [...row.querySelectorAll(".sd-slot")].map((slot) => observeSlot(slot, shown, text)),
    };
    if (!entry.base) incomplete.push({field: `base.${side}`, reason: "no '<n> of <m> orbs' label on the Base"});
    if (!entry.counts) incomplete.push({field: `counts.${side}`, reason: "no 'Hand · Deck · Graveyard' note on the Base"});
    obs.sides[side] = entry;
  }

  obs.hand = [...doc.querySelectorAll("#sd-hand [data-card]")].map((card) => ({
    id: card.dataset.card,
    name: text(card.querySelector(".table-card-title")) || text(card.querySelector("strong")),
    enabled: !card.disabled,
    picked: card.classList.contains("sd-pick"),
    blocked: text(card.querySelector(".sd-warn")) || null,
    shown: shown(card),
  }));
  const button = (id) => {
    const node = doc.getElementById(id);
    return {shown: shown(node), enabled: Boolean(node) && !node.disabled && !node.hidden};
  };
  obs.controls = {
    end: button("sd-end"), cover: button("sd-cover"), cancel: button("sd-cancel"),
    own: [...doc.querySelectorAll("#sd-board [data-own]")].filter((b) => !b.disabled).map((b) => Number(b.dataset.own)),
    enemy: [...doc.querySelectorAll("#sd-board [data-enemy]")].filter((b) => !b.disabled)
      .map((b) => (b.dataset.enemy === "base" ? "base" : Number(b.dataset.enemy))),
    playable: obs.hand.filter((c) => c.enabled).map((c) => c.id),
    result: [...doc.querySelectorAll("#sd-result button")].map((b) => b.id || text(b)),
  };
  obs.prompt = text(doc.getElementById("sd-prompt"));
  obs.location = parseLocation(text(doc.getElementById("sd-location")));
  for (const side of ["cowboy", "wizard"]) obs.graveyards[side] = parseGraveyard(text(doc.getElementById(`sd-${side}-graveyard`)));
  obs.world = observeWorld(doc, win, incomplete, shown, text);
  return obs;
}

function observeSlot(slot, shown, text) {
  const [side, index] = String(slot.dataset.slot ?? "").split("-");
  const name = text(slot.querySelector("strong"));
  const notes = [...slot.querySelectorAll(".sd-note")].map(text);
  const base = {side, slot: Number(index), domShown: shown(slot)};
  if (!name) return {...base, empty: true};
  const attack = /(\d+) attack/.exec(text(slot));
  const gear = notes.find((n) => n.startsWith("◆ "));
  return {...base, empty: false, name,
    attack: attack ? Number(attack[1]) : null,
    orbs: parseOrbs(slot.querySelector(".sd-orbs")?.getAttribute("aria-label")),
    gear: gear ? gear.slice(2).split(", ") : [],
    statuses: notes.filter((n) => ["In cover", "Stunned", "Has attacked", "Rests the turn it arrives"].includes(n)),
    own: slot.dataset.own !== undefined && !slot.disabled,
    enemy: slot.dataset.enemy !== undefined && !slot.disabled};
}

// The 3D layer: canvas motion, world labels and, when scene.js offers it, the presented pawns.
function observeWorld(doc, win, incomplete, shown, text) {
  const canvas = doc.querySelector("canvas.sd-world");
  const labels = [...doc.querySelectorAll(".sd-world-labels > *")].map((node) => ({
    ...parseWorldLabel(text(node), node.dataset), graveSide: node.dataset.graveLabel ?? null, shown: shown(node)}));
  const world = {present: Boolean(canvas), shown: shown(canvas), motion: canvas?.dataset.motion ?? null, labels, pawns: null};
  // Integration point: scene.js keeps its pawns in a closure-private map. A seat-safe hook would list
  // {side, slot, name} for each presented miniature after synchronize().
  const hook = win.__cvwRefereeScene;
  if (typeof hook?.pawns === "function") world.pawns = hook.pawns();
  else incomplete.push({field: "troop.presented3d", reason: "scene.js exposes no window.__cvwRefereeScene.pawns(); the 3D miniatures cannot be listed"});
  if (!canvas) incomplete.push({field: "world.canvas", reason: "no canvas.sd-world on the page"});
  return world;
}
