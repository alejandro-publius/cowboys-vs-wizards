// Showdown Replay Room: one recorded Cowboy turn from the Dragon strategy experiment, a blind choice for the Ranger,
// then the two recorded fixed-policy lines side by side. Plain DOM only: no network, analytics or storage.
// The lessons come from the generated lessons.json (public board and base fields, the Cowboy's own traps).
// Each branch is the recorded continuation of the same bots after that action, kept for comparison, not a forced win.

const IDS = ["dragon-c5", "dragon-c5-70"];
const SIDES = ["cowboy", "wizard"];
const BRANCHES = {
  dragon: {label: "Ranger attacks the Dragon", short: "Dragon"},
  jack: {label: "Ranger attacks the Jack-o'-Lantern", short: "Jack-o'-Lantern"},
};
const SIDE_NAME = {cowboy: "Cowboys", wizard: "Wizards"};
const DECISION_TURN = 5;

const isInt = (value) => Number.isInteger(value);
const isText = (value) => typeof value === "string";

function checkBranch(branch, where) {
  const ok = branch && SIDES.includes(branch.winner) && isInt(branch.endTurn) && Array.isArray(branch.trace)
    && branch.trace.length > 0 && branch.trace.every((row) => row && isInt(row.turn) && SIDES.includes(row.side)
      && isInt(row.cowboyBase) && isInt(row.wizardBase) && isText(row.cowboyBoard) && isText(row.wizardBoard));
  if (!ok) throw new TypeError(`mountReplayRoom: malformed branch ${where}`);
}

function checkLessons(lessons) {
  if (!Array.isArray(lessons) || lessons.length !== 2) throw new TypeError("mountReplayRoom: expected two lessons");
  const ids = lessons.map((lesson) => lesson && lesson.id);
  if (!IDS.every((id) => ids.includes(id))) throw new TypeError("mountReplayRoom: lesson ids must be dragon-c5 and dragon-c5-70");
  for (const lesson of lessons) {
    const ok = isInt(lesson.seed) && lesson.board && isText(lesson.board.cowboy) && isText(lesson.board.wizard)
      && lesson.bases && isInt(lesson.bases.cowboy) && isInt(lesson.bases.wizard)
      && Array.isArray(lesson.ownTraps) && lesson.ownTraps.every(isText) && lesson.branches;
    if (!ok) throw new TypeError(`mountReplayRoom: malformed lesson ${lesson.id}`);
    for (const key of Object.keys(BRANCHES)) checkBranch(lesson.branches[key], `${lesson.id}.${key}`);
  }
  return IDS.map((id) => lessons.find((lesson) => lesson.id === id));
}

// The hosted game's link for one allowlisted turn id. Only http(s) game URLs are accepted.
function turnLink(gameUrl, id, base) {
  if (!IDS.includes(id)) return null;
  let url;
  try { url = new URL(gameUrl, base); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.search = "";
  url.hash = "";
  url.searchParams.set("turn", id);
  return url.href;
}

// Both traces on one list of steps, keyed by turn then side, in recorded order.
function alignTraces(dragon, jack) {
  const keys = [];
  const seen = new Set();
  for (const row of [...dragon.trace, ...jack.trace]) {
    const key = `${row.turn}:${row.side}`;
    if (!seen.has(key)) { seen.add(key); keys.push({turn: row.turn, side: row.side, key}); }
  }
  keys.sort((a, b) => a.turn - b.turn || SIDES.indexOf(a.side) - SIDES.indexOf(b.side));
  const pick = (branch, key) => {
    const rows = branch.trace.filter((row) => `${row.turn}:${row.side}` === key);
    return rows.length ? rows[rows.length - 1] : null;
  };
  return keys.map(({turn, side, key}) => ({turn, side, dragon: pick(dragon, key), jack: pick(jack, key)}));
}

function stepLabel(step) {
  if (step.turn === DECISION_TURN && step.side === "cowboy") return `Turn ${step.turn}: after your Ranger's action`;
  return `Turn ${step.turn}: after the ${step.side === "cowboy" ? "Cowboy" : "Wizard"} turn`;
}

export function mountReplayRoom(root, lessons, {gameUrl} = {}) {
  if (!root || typeof root.appendChild !== "function") throw new TypeError("mountReplayRoom: root must be an element");
  const deals = checkLessons(lessons);
  const doc = root.ownerDocument;
  const uid = `rr${Math.random().toString(36).slice(2, 8)}`;
  const listeners = [];

  const h = (tag, attrs = {}, ...children) => {
    const el = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      if (name === "text") el.textContent = value;
      else if (name === "className") el.className = value;
      else el.setAttribute(name, value === true ? "" : String(value));
    }
    for (const child of children) if (child) el.append(child);
    return el;
  };
  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push([el, type, fn]); };
  const clear = (el) => { while (el.firstChild) el.firstChild.remove(); };

  const state = {deal: 0, choice: null, step: 0};

  // Layout
  const shell = h("section", {className: "rr-room", "aria-labelledby": `${uid}-title`});
  const header = h("header", {className: "rr-head"},
    h("p", {className: "rr-kicker", text: "Showdown Replay Room"}),
    h("h2", {id: `${uid}-title`, className: "rr-title", text: "The Graveyard Dragon, your turn 5"}),
    h("p", {className: "rr-lede", text: "Read the table, then choose what your Ranger attacks. The outcome stays hidden until you choose."}));

  const dealGroup = h("div", {className: "rr-deals", role: "group", "aria-label": "Recorded deal"});
  const dealButtons = deals.map((lesson, index) => {
    const button = h("button", {type: "button", className: "rr-deal", "data-deal": index,
      text: `Deal ${index + 1} · seed ${lesson.seed}`});
    on(button, "click", () => selectDeal(index, button));
    dealGroup.append(button);
    return button;
  });

  const tableHeading = h("h3", {id: `${uid}-table`, className: "rr-sub", tabindex: "-1", text: "The table before you act"});
  const tableBody = h("div", {className: "rr-table"});
  const tablePanel = h("section", {className: "rr-panel", "aria-labelledby": `${uid}-table`}, tableHeading, tableBody);

  const choiceHeading = h("legend", {className: "rr-sub", text: "What does your Ranger attack?"});
  const choiceSet = h("fieldset", {className: "rr-choices"}, choiceHeading);
  const choiceButtons = Object.entries(BRANCHES).map(([key, {label}]) => {
    const button = h("button", {type: "button", className: "rr-choice", "data-branch": key, text: label});
    on(button, "click", () => choose(key));
    choiceSet.append(button);
    return button;
  });

  const revealHeading = h("h3", {id: `${uid}-reveal`, className: "rr-sub", tabindex: "-1", text: "Recorded lines"});
  const revealBody = h("div", {className: "rr-reveal-body"});
  const caveat = h("p", {className: "rr-caveat", text: "Each line is the recorded continuation of the same fixed bots after "
    + "that action, kept for comparison. It is not a forced win and does not predict how a person would play on."});
  const stepHeading = h("h4", {className: "rr-step-title", id: `${uid}-step`, text: "Step through both lines"});
  const stepStatus = h("p", {className: "rr-step-status", "aria-live": "polite", id: `${uid}-status`});
  const prev = h("button", {type: "button", className: "rr-btn", text: "Previous step"});
  const next = h("button", {type: "button", className: "rr-btn", text: "Next step"});
  const stepGrid = h("div", {className: "rr-step-grid"});
  const stepper = h("div", {className: "rr-stepper", role: "group", "aria-labelledby": `${uid}-step`,
    "aria-describedby": `${uid}-status`}, stepHeading, h("div", {className: "rr-step-nav"}, prev, stepStatus, next), stepGrid);
  const resetButton = h("button", {type: "button", className: "rr-btn", text: "Hide outcome and choose again"});
  const otherDeal = h("button", {type: "button", className: "rr-btn", text: "Try the other deal"});
  const playLink = h("a", {className: "rr-btn rr-play"});
  const actions = h("div", {className: "rr-actions"}, resetButton, otherDeal, playLink);
  const reveal = h("section", {className: "rr-panel rr-reveal", "aria-labelledby": `${uid}-reveal`, hidden: true},
    revealHeading, revealBody, caveat, stepper, actions);

  shell.append(header, dealGroup, tablePanel, choiceSet, reveal);
  root.append(shell);

  const lesson = () => deals[state.deal];
  const steps = () => alignTraces(lesson().branches.dragon, lesson().branches.jack);

  function boardBlock(title, bases, board) {
    return h("div", {className: "rr-side"},
      h("p", {className: "rr-side-name", text: title}),
      h("p", {className: "rr-base", text: `Base ${bases}`}),
      h("p", {className: "rr-board", text: board || "Empty board"}));
  }

  function renderTable() {
    const current = lesson();
    clear(tableBody);
    const traps = current.ownTraps.length ? current.ownTraps.join(", ") : "None";
    tableBody.append(
      boardBlock("Wizards", current.bases.wizard, current.board.wizard),
      boardBlock("Cowboys (you)", current.bases.cowboy, current.board.cowboy),
      h("p", {className: "rr-traps"}, h("span", {className: "rr-label", text: "Your set traps: "}), traps));
    dealButtons.forEach((button, index) => button.setAttribute("aria-pressed", String(index === state.deal)));
  }

  function outcomeLine(key, chosen) {
    const branch = lesson().branches[key];
    return h("li", {className: chosen ? "rr-outcome rr-chosen" : "rr-outcome"},
      h("span", {className: "rr-label", text: `${chosen ? "Your choice" : "Other choice"}: ${BRANCHES[key].label}. `}),
      `Recorded line: ${SIDE_NAME[branch.winner]} win, game ends on turn ${branch.endTurn}.`);
  }

  function traceCell(key, row, branch) {
    const cell = h("div", {className: "rr-trace"}, h("p", {className: "rr-trace-name",
      text: `${BRANCHES[key].short} line${state.choice === key ? " (your choice)" : ""}`}));
    if (!row) {
      const lastTurn = branch.trace[branch.trace.length - 1].turn;
      const past = lastTurn < steps()[state.step].turn;
      const text = !past ? "No record at this step."
        : lastTurn === branch.endTurn ? `No later record: this line ended on turn ${branch.endTurn}.`
          : `No snapshot recorded after turn ${lastTurn}; the line ends on turn ${branch.endTurn}.`;
      cell.append(h("p", {className: "rr-note", text}));
      return cell;
    }
    cell.append(
      h("p", {className: "rr-base", text: `Wizard base ${row.wizardBase} · Cowboy base ${row.cowboyBase}`}),
      h("p", {className: "rr-board"}, h("span", {className: "rr-label", text: "Wizards: "}), row.wizardBoard || "Empty board"),
      h("p", {className: "rr-board"}, h("span", {className: "rr-label", text: "Cowboys: "}), row.cowboyBoard || "Empty board"));
    const isLast = row === branch.trace[branch.trace.length - 1];
    if (isLast && row.turn === branch.endTurn) cell.append(h("p", {className: "rr-note", text: `Last recorded state: ${SIDE_NAME[branch.winner]} win on turn ${branch.endTurn}.`}));
    else if (isLast) cell.append(h("p", {className: "rr-note", text: `Last recorded snapshot, mid-game; the line ends on turn ${branch.endTurn}.`}));
    else cell.append(h("p", {className: "rr-note", text: "Mid-game snapshot, not the result."}));
    return cell;
  }

  function renderStep() {
    const all = steps();
    state.step = Math.max(0, Math.min(state.step, all.length - 1));
    const step = all[state.step];
    stepStatus.textContent = `Step ${state.step + 1} of ${all.length}. ${stepLabel(step)}`;
    prev.disabled = state.step === 0;
    next.disabled = state.step === all.length - 1;
    clear(stepGrid);
    for (const key of Object.keys(BRANCHES)) stepGrid.append(traceCell(key, step[key], lesson().branches[key]));
  }

  function renderReveal() {
    const revealed = state.choice !== null;
    reveal.hidden = !revealed;
    choiceButtons.forEach((button) => {
      button.disabled = revealed;
      button.setAttribute("aria-pressed", String(button.dataset.branch === state.choice));
    });
    clear(revealBody);
    if (!revealed) return;
    const other = state.choice === "dragon" ? "jack" : "dragon";
    revealBody.append(h("ul", {className: "rr-outcomes"}, outcomeLine(state.choice, true), outcomeLine(other, false)));
    const href = turnLink(gameUrl, lesson().id, doc.baseURI);
    playLink.hidden = !href;
    if (href) {
      playLink.href = href;
      playLink.textContent = `Play this turn in the game (deal ${state.deal + 1})`;
    }
    otherDeal.textContent = `Try deal ${2 - state.deal}`;
    renderStep();
  }

  function choose(key) {
    if (state.choice !== null || !Object.hasOwn(BRANCHES, key)) return;
    state.choice = key;
    const at = steps().findIndex((step) => step.turn === DECISION_TURN && step.side === "cowboy");
    state.step = at < 0 ? 0 : at;
    renderReveal();
    revealHeading.focus();
  }

  function reset(focusTarget) {
    state.choice = null;
    state.step = 0;
    renderReveal();
    (focusTarget ?? choiceButtons[0]).focus();
  }

  function selectDeal(index, focusTarget) {
    state.deal = index;
    renderTable();
    reset(focusTarget ?? tableHeading);
  }

  on(prev, "click", () => { state.step -= 1; renderStep(); if (prev.disabled) next.focus(); });
  on(next, "click", () => { state.step += 1; renderStep(); if (next.disabled) prev.focus(); });
  on(stepper, "keydown", (event) => {
    const move = {ArrowLeft: -1, ArrowRight: 1}[event.key];
    const ends = {Home: 0, End: steps().length - 1}[event.key];
    if (move === undefined && ends === undefined) return;
    event.preventDefault();
    state.step = ends ?? state.step + move;
    renderStep();
  });
  on(resetButton, "click", () => reset());
  on(otherDeal, "click", () => selectDeal(1 - state.deal));

  renderTable();
  renderReveal();

  let mounted = true;
  return function unmount() {
    if (!mounted) return;
    mounted = false;
    for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
    listeners.length = 0;
    shell.remove();
  };
}
