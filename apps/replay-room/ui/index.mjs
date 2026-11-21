// Built by apps/replay-room/build.mjs from src/. Edit the source and rebuild.

// src/crew.mjs
import { createElement, useEffect, useRef } from "react";

// src/room.mjs
var IDS = ["dragon-c5", "dragon-c5-70"];
var SIDES = ["cowboy", "wizard"];
var BRANCHES = {
  dragon: { label: "Ranger attacks the Dragon", short: "Dragon" },
  jack: { label: "Ranger attacks the Jack-o'-Lantern", short: "Jack-o'-Lantern" }
};
var SIDE_NAME = { cowboy: "Cowboys", wizard: "Wizards" };
var DECISION_TURN = 5;
var TABLES = ["Table A", "Table B"];
var isInt = (value) => Number.isInteger(value);
var isText = (value) => typeof value === "string";
function checkBranch(branch, where) {
  const ok = branch && SIDES.includes(branch.winner) && isInt(branch.endTurn) && Array.isArray(branch.trace) && branch.trace.length > 0 && branch.trace.every((row) => row && isInt(row.turn) && SIDES.includes(row.side) && isInt(row.cowboyBase) && isInt(row.wizardBase) && isText(row.cowboyBoard) && isText(row.wizardBoard));
  if (!ok) throw new TypeError(`mountReplayRoom: malformed branch ${where}`);
}
function checkLessons(lessons) {
  if (!Array.isArray(lessons) || lessons.length !== 2) throw new TypeError("mountReplayRoom: expected two lessons");
  const ids = lessons.map((lesson) => lesson && lesson.id);
  if (!IDS.every((id) => ids.includes(id))) throw new TypeError("mountReplayRoom: lesson ids must be dragon-c5 and dragon-c5-70");
  for (const lesson of lessons) {
    const ok = isInt(lesson.seed) && lesson.board && isText(lesson.board.cowboy) && isText(lesson.board.wizard) && lesson.bases && isInt(lesson.bases.cowboy) && isInt(lesson.bases.wizard) && Array.isArray(lesson.ownTraps) && lesson.ownTraps.every(isText) && lesson.branches;
    if (!ok) throw new TypeError(`mountReplayRoom: malformed lesson ${lesson.id}`);
    for (const key of Object.keys(BRANCHES)) checkBranch(lesson.branches[key], `${lesson.id}.${key}`);
  }
  return IDS.map((id) => lessons.find((lesson) => lesson.id === id));
}
function turnLink(gameUrl, id, base) {
  if (!IDS.includes(id)) return null;
  let url;
  try {
    url = new URL(gameUrl, base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.search = "";
  url.hash = "";
  url.searchParams.set("turn", id);
  return url.href;
}
function alignTraces(dragon, jack) {
  const keys = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of [...dragon.trace, ...jack.trace]) {
    const key = `${row.turn}:${row.side}`;
    if (!seen.has(key)) {
      seen.add(key);
      keys.push({ turn: row.turn, side: row.side, key });
    }
  }
  keys.sort((a, b) => a.turn - b.turn || SIDES.indexOf(a.side) - SIDES.indexOf(b.side));
  const pick = (branch, key) => {
    const rows = branch.trace.filter((row) => `${row.turn}:${row.side}` === key);
    return rows.length ? rows[rows.length - 1] : null;
  };
  return keys.map(({ turn, side, key }) => ({ turn, side, dragon: pick(dragon, key), jack: pick(jack, key) }));
}
function stepLabel(step) {
  if (step.turn === DECISION_TURN && step.side === "cowboy") return "End of Cowboy turn 5, after the Ranger attacks";
  return `Turn ${step.turn}: after the ${step.side === "cowboy" ? "Cowboy" : "Wizard"} turn`;
}
function mountReplayRoom(root, lessons, { gameUrl, onPlayTurn } = {}) {
  if (!root || typeof root.appendChild !== "function") throw new TypeError("mountReplayRoom: root must be an element");
  const deals = checkLessons(lessons);
  const doc = root.ownerDocument;
  const uid = `rr${Math.random().toString(36).slice(2, 8)}`;
  const listeners = [];
  const h = (tag, attrs = {}, ...children) => {
    const el = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === void 0) continue;
      if (name === "text") el.textContent = value;
      else if (name === "className") el.className = value;
      else el.setAttribute(name, value === true ? "" : String(value));
    }
    for (const child of children) if (child) el.append(child);
    return el;
  };
  const on = (el, type, fn) => {
    el.addEventListener(type, fn);
    listeners.push([el, type, fn]);
  };
  const clear = (el) => {
    while (el.firstChild) el.firstChild.remove();
  };
  const state = { deal: 0, choice: null, step: 0 };
  const shell = h("section", { className: "rr-room", "aria-labelledby": `${uid}-title` });
  const header = h(
    "header",
    { className: "rr-head" },
    h("p", { className: "rr-kicker", text: "Showdown Replay Room" }),
    h("h2", { id: `${uid}-title`, className: "rr-title", text: "The Graveyard Dragon, your turn 5" }),
    h("p", { className: "rr-lede", text: "Pick the Ranger\u2019s target. Then follow both fights and see what changes. A troop\u2019s numbers are attack / remaining life." })
  );
  const dealGroup = h("div", { className: "rr-deals", role: "group", "aria-label": "Recorded deal" });
  const dealButtons = deals.map((_, index) => {
    const button = h("button", {
      type: "button",
      className: "rr-deal",
      "data-deal": index,
      text: TABLES[index]
    });
    on(button, "click", () => selectDeal(index, button));
    dealGroup.append(button);
    return button;
  });
  const tableHeading = h("h3", { id: `${uid}-table`, className: "rr-sub", tabindex: "-1", text: "The table before you act" });
  const tableBody = h("div", { className: "rr-table" });
  const tablePanel = h("section", { className: "rr-panel", "aria-labelledby": `${uid}-table` }, tableHeading, tableBody);
  const choiceHeading = h("legend", { className: "rr-sub", text: "What does your Ranger attack?" });
  const choiceSet = h("fieldset", { className: "rr-choices" }, choiceHeading);
  const choiceButtons = Object.entries(BRANCHES).map(([key, { label }]) => {
    const button = h("button", { type: "button", className: "rr-choice", "data-branch": key, text: label });
    on(button, "click", () => choose(key));
    choiceSet.append(button);
    return button;
  });
  const revealHeading = h("h3", { id: `${uid}-reveal`, className: "rr-sub", tabindex: "-1", text: "Recorded lines" });
  const revealBody = h("div", { className: "rr-reveal-body" });
  const caveat = h("p", { className: "rr-caveat", text: "Both replays use the same draws and bot strategy after your choice. Playing the rest of the duel yourself can change the result." });
  const stepHeading = h("h4", { className: "rr-step-title", id: `${uid}-step`, text: "Step through both lines" });
  const stepStatus = h("p", { className: "rr-step-status", "aria-live": "polite", id: `${uid}-status` });
  const prev = h("button", { type: "button", className: "rr-btn", text: "Previous step" });
  const next = h("button", { type: "button", className: "rr-btn", text: "Next step" });
  const stepGrid = h("div", { className: "rr-step-grid" });
  const stepper = h("div", {
    className: "rr-stepper",
    role: "group",
    "aria-labelledby": `${uid}-step`,
    "aria-describedby": `${uid}-status`
  }, stepHeading, h("div", { className: "rr-step-nav" }, prev, stepStatus, next), stepGrid);
  const resetButton = h("button", { type: "button", className: "rr-btn", text: "Hide outcome and choose again" });
  const otherDeal = h("button", { type: "button", className: "rr-btn", text: "Try the other deal" });
  const playLink = onPlayTurn ? h("button", { type: "button", className: "rr-btn rr-play" }) : h("a", { className: "rr-btn rr-play" });
  if (onPlayTurn) on(playLink, "click", () => onPlayTurn(lesson().id));
  const actions = h("div", { className: "rr-actions" }, resetButton, otherDeal, playLink);
  const reveal = h(
    "section",
    { className: "rr-panel rr-reveal", "aria-labelledby": `${uid}-reveal`, hidden: true },
    revealHeading,
    revealBody,
    caveat,
    stepper,
    actions
  );
  const glossary = h(
    "details",
    { className: "rr-glossary" },
    h("summary", { text: "What do cover, resting and Bear Trap mean?" }),
    h("p", { text: "Cover stops a troop from hitting back. Damage beyond its remaining life does not reach its Base." }),
    h("p", { text: "A resting troop cannot attack yet. It can take cover." }),
    h("p", { text: "Bear Trap takes 2 life from the next enemy attacker before it hits. If that defeats it, its attack ends." })
  );
  shell.append(header, dealGroup, tablePanel, glossary, choiceSet, reveal);
  root.append(shell);
  const lesson = () => deals[state.deal];
  const steps = () => alignTraces(lesson().branches.dragon, lesson().branches.jack);
  function boardBlock(title, bases, board) {
    return h(
      "div",
      { className: "rr-side" },
      h("p", { className: "rr-side-name", text: title }),
      h("p", { className: "rr-base", text: `Base ${bases}` }),
      h("p", { className: "rr-board", text: board || "Empty board" })
    );
  }
  function renderTable() {
    const current = lesson();
    clear(tableBody);
    const traps = current.ownTraps.length ? current.ownTraps.join(", ") : "None";
    tableBody.append(
      boardBlock("Wizards", current.bases.wizard, current.board.wizard),
      boardBlock("Cowboys (you)", current.bases.cowboy, current.board.cowboy),
      h("p", { className: "rr-traps" }, h("span", { className: "rr-label", text: "Your set traps: " }), traps)
    );
    dealButtons.forEach((button, index) => button.setAttribute("aria-pressed", String(index === state.deal)));
  }
  function outcomeLine(key, chosen) {
    const branch = lesson().branches[key];
    return h(
      "li",
      { className: chosen ? "rr-outcome rr-chosen" : "rr-outcome" },
      h("span", { className: "rr-label", text: `${chosen ? "Your choice" : "Other choice"}: ${BRANCHES[key].label}. ` }),
      `Recorded line: ${SIDE_NAME[branch.winner]} win, game ends on turn ${branch.endTurn}.`
    );
  }
  function traceCell(key, row, branch) {
    const cell = h("div", { className: "rr-trace" }, h("p", {
      className: "rr-trace-name",
      text: `${BRANCHES[key].short} line${state.choice === key ? " (your choice)" : ""}`
    }));
    if (!row) {
      const lastTurn = branch.trace[branch.trace.length - 1].turn;
      const past = lastTurn < steps()[state.step].turn;
      const text = !past ? "No record at this step." : lastTurn === branch.endTurn ? `No later record: this line ended on turn ${branch.endTurn}.` : `No snapshot recorded after turn ${lastTurn}; the line ends on turn ${branch.endTurn}.`;
      cell.append(h("p", { className: "rr-note", text }));
      return cell;
    }
    cell.append(
      h("p", { className: "rr-base", text: `Wizard base ${row.wizardBase} \xB7 Cowboy base ${row.cowboyBase}` }),
      h("p", { className: "rr-board" }, h("span", { className: "rr-label", text: "Wizards: " }), row.wizardBoard || "Empty board"),
      h("p", { className: "rr-board" }, h("span", { className: "rr-label", text: "Cowboys: " }), row.cowboyBoard || "Empty board")
    );
    const isLast = row === branch.trace[branch.trace.length - 1];
    if (isLast && row.turn === branch.endTurn) cell.append(h("p", { className: "rr-note", text: `Last recorded state: ${SIDE_NAME[branch.winner]} win on turn ${branch.endTurn}.` }));
    else if (isLast) cell.append(h("p", { className: "rr-note", text: `Last recorded snapshot, mid-game; the line ends on turn ${branch.endTurn}.` }));
    else cell.append(h("p", { className: "rr-note", text: "Mid-game snapshot, not the result." }));
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
    revealBody.append(h("ul", { className: "rr-outcomes" }, outcomeLine(state.choice, true), outcomeLine(other, false)));
    const href = turnLink(gameUrl, lesson().id, doc.baseURI);
    playLink.hidden = !onPlayTurn && !href;
    if (!onPlayTurn && href) playLink.href = href;
    playLink.textContent = "Play this turn yourself";
    otherDeal.textContent = `Try ${TABLES[1 - state.deal]}`;
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
  on(prev, "click", () => {
    state.step -= 1;
    renderStep();
    if (prev.disabled) next.focus();
  });
  on(next, "click", () => {
    state.step += 1;
    renderStep();
    if (next.disabled) prev.focus();
  });
  on(stepper, "keydown", (event) => {
    const move = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    const ends = { Home: 0, End: steps().length - 1 }[event.key];
    if (move === void 0 && ends === void 0) return;
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

// src/lessons.json
var lessons_default = [
  {
    id: "dragon-c5",
    seed: 3,
    board: {
      cowboy: "Ranger 2/4 | Dynamiter 3/1 resting | -",
      wizard: "Dragon 3/4 | Jack-o'-Lantern 1/1 cover | -"
    },
    bases: {
      cowboy: 5,
      wizard: 3
    },
    ownTraps: [
      "Bear Trap"
    ],
    branches: {
      dragon: {
        winner: "cowboy",
        endTurn: 15,
        trace: [
          {
            turn: 5,
            side: "cowboy",
            cowboyBase: 5,
            wizardBase: 3,
            cowboyBoard: "Ranger 2/1 | Dynamiter 3/1 cover | -",
            wizardBoard: "Dragon 3/2 | Jack-o'-Lantern 1/1 | -"
          },
          {
            turn: 6,
            side: "wizard",
            cowboyBase: 4,
            wizardBase: 3,
            cowboyBoard: "- | Dynamiter 3/1 | -",
            wizardBoard: "- | Wizard 2/4 | Skeleton 1/1 cover"
          },
          {
            turn: 7,
            side: "cowboy",
            cowboyBase: 4,
            wizardBase: 3,
            cowboyBoard: "Outrider 1/3 | Dynamiter 3/1 | -",
            wizardBoard: "- | Wizard 2/4 | -"
          },
          {
            turn: 8,
            side: "wizard",
            cowboyBase: 3,
            wizardBase: 3,
            cowboyBoard: "Outrider 1/2 | - | -",
            wizardBoard: "Skeleton 1/3 | Wizard 2/3 | -"
          }
        ]
      },
      jack: {
        winner: "wizard",
        endTurn: 10,
        trace: [
          {
            turn: 5,
            side: "cowboy",
            cowboyBase: 5,
            wizardBase: 3,
            cowboyBoard: "Ranger 2/3 | Dynamiter 3/1 cover | -",
            wizardBoard: "Dragon 3/4 | - | -"
          },
          {
            turn: 6,
            side: "wizard",
            cowboyBase: 4,
            wizardBase: 3,
            cowboyBoard: "- | - | -",
            wizardBoard: "Dragon 3/2 | Skeleton 1/3 | -"
          },
          {
            turn: 7,
            side: "cowboy",
            cowboyBase: 4,
            wizardBase: 3,
            cowboyBoard: "Outrider 1/3 | - | -",
            wizardBoard: "Dragon 3/2 | Skeleton 1/3 | -"
          },
          {
            turn: 8,
            side: "wizard",
            cowboyBase: 2,
            wizardBase: 3,
            cowboyBoard: "- | - | -",
            wizardBoard: "Dragon 3/2 | Wizard 2/4 | Skeleton 1/1"
          }
        ]
      }
    }
  },
  {
    id: "dragon-c5-70",
    seed: 70,
    board: {
      cowboy: "Ranger 2/4 | Covered Wagon 1/4 resting | -",
      wizard: "Dragon 3/4 | Jack-o'-Lantern 1/1 cover | -"
    },
    bases: {
      cowboy: 5,
      wizard: 4
    },
    ownTraps: [],
    branches: {
      dragon: {
        winner: "wizard",
        endTurn: 14,
        trace: [
          {
            turn: 5,
            side: "cowboy",
            cowboyBase: 5,
            wizardBase: 4,
            cowboyBoard: "Ranger 2/1 | Covered Wagon 1/4 | -",
            wizardBoard: "Dragon 3/2 | Jack-o'-Lantern 1/1 | -"
          },
          {
            turn: 6,
            side: "wizard",
            cowboyBase: 4,
            wizardBase: 4,
            cowboyBoard: "- | - | -",
            wizardBoard: "Dragon 3/1 | Wizard 2/4 | Skeleton 1/1"
          },
          {
            turn: 7,
            side: "cowboy",
            cowboyBase: 4,
            wizardBase: 4,
            cowboyBoard: "Outrider 1/3 | - | -",
            wizardBoard: "Dragon 3/1 | Wizard 2/4 | Skeleton 1/1"
          },
          {
            turn: 8,
            side: "wizard",
            cowboyBase: 4,
            wizardBase: 4,
            cowboyBoard: "- | - | -",
            wizardBoard: "- | Wizard 2/3 | Skeleton 1/1"
          }
        ]
      },
      jack: {
        winner: "cowboy",
        endTurn: 17,
        trace: [
          {
            turn: 5,
            side: "cowboy",
            cowboyBase: 5,
            wizardBase: 4,
            cowboyBoard: "Ranger 2/3 | Covered Wagon 1/4 | -",
            wizardBoard: "Dragon 3/4 | - | -"
          },
          {
            turn: 6,
            side: "wizard",
            cowboyBase: 5,
            wizardBase: 4,
            cowboyBoard: "Ranger 2/2 | Covered Wagon 1/1 | -",
            wizardBoard: "Dragon 3/3 | Raven Familiar 1/1 cover | -"
          },
          {
            turn: 7,
            side: "cowboy",
            cowboyBase: 5,
            wizardBase: 3,
            cowboyBoard: "Ranger 2/2 | Billy 2/1 | -",
            wizardBoard: "- | Raven Familiar 1/1 | -"
          },
          {
            turn: 8,
            side: "wizard",
            cowboyBase: 4,
            wizardBase: 3,
            cowboyBoard: "Ranger 2/2 | - | -",
            wizardBoard: "Wizard 2/2 | Skeleton 1/1 cover | -"
          }
        ]
      }
    }
  }
];

// src/room.css
var room_default = '/* Showdown Replay Room. Every rule is scoped under .rr-room; system fonts only, no remote assets. */\n.rr-room {\n  --rr-ink: #ece2cc;\n  --rr-dim: #b9ab8e;\n  --rr-bg: #17130f;\n  --rr-panel: #221c16;\n  --rr-line: #4a3c2c;\n  --rr-brass: #d2a24c;\n  --rr-ghost: #8fc7b4;\n  --rr-focus: #f3d27a;\n  box-sizing: border-box;\n  max-width: 46rem;\n  margin: 0 auto;\n  padding: 1rem 1.1rem 1.4rem;\n  color: var(--rr-ink);\n  background: var(--rr-bg);\n  border: 1px solid var(--rr-line);\n  border-radius: 6px;\n  font: 400 1rem/1.45 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;\n}\n.rr-room *, .rr-room *::before, .rr-room *::after { box-sizing: inherit; }\n.rr-room [hidden] { display: none !important; }\n.rr-room p, .rr-room ul, .rr-room h2, .rr-room h3, .rr-room h4 { margin: 0; }\n\n.rr-room .rr-kicker {\n  color: var(--rr-brass);\n  font-size: 0.78rem;\n  letter-spacing: 0.18em;\n  text-transform: uppercase;\n}\n.rr-room .rr-title {\n  margin-top: 0.15rem;\n  font-size: 1.45rem;\n  font-weight: 600;\n  letter-spacing: 0.02em;\n  font-variant: small-caps;\n}\n.rr-room .rr-lede { margin-top: 0.35rem; color: var(--rr-dim); }\n.rr-room .rr-sub {\n  padding: 0;\n  font-size: 1.02rem;\n  font-weight: 600;\n  font-variant: small-caps;\n  letter-spacing: 0.05em;\n  color: var(--rr-brass);\n}\n.rr-room .rr-label { color: var(--rr-dim); }\n\n.rr-room .rr-deals, .rr-room .rr-actions, .rr-room .rr-step-nav {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.5rem;\n  align-items: center;\n}\n.rr-room .rr-deals { margin: 0.9rem 0; }\n\n.rr-room button, .rr-room .rr-btn {\n  display: inline-flex;\n  align-items: center;\n  min-height: 2.5rem;\n  padding: 0.4rem 0.85rem;\n  border: 1px solid var(--rr-line);\n  border-radius: 4px;\n  background: var(--rr-panel);\n  color: var(--rr-ink);\n  font: inherit;\n  text-decoration: none;\n  cursor: pointer;\n}\n.rr-room button:hover:not(:disabled), .rr-room a.rr-btn:hover { border-color: var(--rr-brass); }\n.rr-room button:disabled { cursor: default; opacity: 0.55; }\n.rr-room button[aria-pressed="true"] { border-color: var(--rr-brass); color: var(--rr-brass); opacity: 1; }\n.rr-room :focus-visible { outline: 3px solid var(--rr-focus); outline-offset: 2px; }\n.rr-room h3:focus { outline: none; }\n.rr-room h3:focus-visible { outline: 3px solid var(--rr-focus); outline-offset: 2px; }\n\n.rr-room .rr-panel, .rr-room .rr-choices {\n  margin: 0 0 0.9rem;\n  padding: 0.8rem 0.9rem;\n  border: 1px solid var(--rr-line);\n  border-radius: 4px;\n  background: var(--rr-panel);\n}\n.rr-room .rr-table, .rr-room .rr-step-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));\n  gap: 0.6rem;\n  margin-top: 0.55rem;\n}\n.rr-room .rr-side, .rr-room .rr-trace {\n  padding: 0.55rem 0.65rem;\n  border-left: 3px solid var(--rr-line);\n  background: rgba(0, 0, 0, 0.18);\n}\n.rr-room .rr-side-name, .rr-room .rr-trace-name { font-weight: 600; letter-spacing: 0.03em; }\n.rr-room .rr-base { font-variant-numeric: tabular-nums; color: var(--rr-brass); }\n.rr-room .rr-board { overflow-wrap: anywhere; }\n.rr-room .rr-traps { grid-column: 1 / -1; }\n\n.rr-room .rr-choices { display: flex; flex-wrap: wrap; gap: 0.6rem; }\n.rr-room .rr-choices legend { float: left; width: 100%; margin-bottom: 0.15rem; }\n.rr-room .rr-choice { flex: 1 1 14rem; justify-content: center; font-weight: 600; }\n\n.rr-room .rr-outcomes { margin-top: 0.5rem; padding-left: 1.1rem; }\n.rr-room .rr-outcome { margin: 0.2rem 0; }\n.rr-room .rr-chosen { color: var(--rr-ghost); }\n.rr-room .rr-caveat {\n  margin-top: 0.6rem;\n  font-size: 0.9rem;\n  font-style: italic;\n  color: var(--rr-dim);\n}\n.rr-room .rr-stepper { margin-top: 0.9rem; padding-top: 0.7rem; border-top: 1px dashed var(--rr-line); }\n.rr-room .rr-step-title { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; }\n.rr-room .rr-step-status { flex: 1 1 12rem; font-variant-numeric: tabular-nums; }\n.rr-room .rr-note { margin-top: 0.3rem; font-size: 0.88rem; color: var(--rr-dim); }\n.rr-room .rr-actions { margin-top: 0.9rem; }\n.rr-room .rr-play { border-color: var(--rr-brass); color: var(--rr-brass); }\n\n@media (prefers-reduced-motion: no-preference) {\n  .rr-room button, .rr-room .rr-btn { transition: border-color 120ms ease; }\n}\n';

// src/crew.mjs
function ReplayRoom() {
  const container = useRef(null);
  useEffect(() => mountReplayRoom(container.current, lessons_default, {
    gameUrl: "https://alejandro-publius.github.io/cowboys-vs-wizards/"
  }), []);
  return createElement("div", null, createElement("style", null, room_default), createElement("div", { ref: container }));
}
export {
  ReplayRoom as default
};
