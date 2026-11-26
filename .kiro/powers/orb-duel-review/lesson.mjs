// Replay Room coaching lesson: a two-stage, read-only view of the recorded C5 Dragon cases in
// <bound project>/apps/replay-room/src/lessons.json. Stage one (no target) returns the Cowboy seat's
// position only. Stage two (an explicit target) returns both recorded outcomes, chosen first, and the
// chosen branch's public trace. Every returned field is selected by name and type-checked here; nothing
// is copied by spread, so extra fields in a malformed file never reach the agent. Error messages name
// fields, never their values.
import {readFileSync} from "node:fs";

export const LESSONS_PATH = "apps/replay-room/src/lessons.json";
export const TURN_IDS = ["dragon-c5", "dragon-c5-70"];
export const LESSON_TARGETS = ["dragon", "jack"];
const TARGET_LABELS = {dragon: "Ranger attacks Dragon", jack: "Ranger attacks Jack-o'-Lantern"};
const SIDES = ["cowboy", "wizard"];
const MAX_TEXT = 200;
export const LESSON_SOURCE = "recorded fixed bots: one fixed-policy line per target (Cowboys planTurn on the Cowboy view, Wizards playTurn at the hunt level), recorded for comparison; neither line is a forced win";

export const LESSON_TOOL = {
  name: "showdown_replay_lesson",
  description: "Replay Room coaching lesson for one recorded Showdown Cowboy turn. Required turnId: dragon-c5 (seed 3) or dragon-c5-70 (seed 70). Call first without target: returns only the visible board, bases, the Cowboys' own traps, allowed targets, turn and seed, with no outcome. Then call with target dragon or jack: returns both recorded outcomes (chosen first) and the chosen line's public trace, from recorded fixed bots.",
  inputSchema: {
    type: "object",
    properties: {
      turnId: {type: "string", enum: TURN_IDS},
      target: {type: "string", enum: LESSON_TARGETS},
    },
    required: ["turnId"],
    additionalProperties: false,
  },
};

// Protocol-level argument check. Returns an error message, or null when the arguments are acceptable.
export function lessonArgsError(args) {
  if (typeof args !== "object" || args === null || Array.isArray(args)) return "showdown_replay_lesson takes an object";
  if (Object.keys(args).some((key) => key !== "turnId" && key !== "target")) return "Only the turnId and target inputs are accepted";
  if (typeof args.turnId !== "string" || !TURN_IDS.includes(args.turnId)) return `turnId must be one of: ${TURN_IDS.join(", ")}`;
  if (args.target !== undefined && (typeof args.target !== "string" || !LESSON_TARGETS.includes(args.target))) return `target must be one of: ${LESSON_TARGETS.join(", ")}`;
  return null;
}

class LessonDataError extends Error {}
const bad = (what) => { throw new LessonDataError(`${LESSONS_PATH}: ${what}`); };
const obj = (v, what) => (v && typeof v === "object" && !Array.isArray(v) ? v : bad(`${what} is not an object`));
const int = (v, what) => (Number.isInteger(v) && v >= 0 ? v : bad(`${what} is not a non-negative integer`));
const text = (v, what) => (typeof v === "string" && v.length <= MAX_TEXT && !/[\u0000-\u001f]/.test(v) ? v : bad(`${what} is not a short single-line string`));
const side = (v, what) => (SIDES.includes(v) ? v : bad(`${what} is not cowboy or wizard`));
const list = (v, what) => (Array.isArray(v) ? v : bad(`${what} is not an array`));

function selectStep(t, what) {
  obj(t, what);
  return {
    turn: int(t.turn, `${what}.turn`),
    side: side(t.side, `${what}.side`),
    cowboyBase: int(t.cowboyBase, `${what}.cowboyBase`),
    wizardBase: int(t.wizardBase, `${what}.wizardBase`),
    cowboyBoard: text(t.cowboyBoard, `${what}.cowboyBoard`),
    wizardBoard: text(t.wizardBoard, `${what}.wizardBoard`),
  };
}

function selectBranch(b, what) {
  obj(b, what);
  const trace = list(b.trace, `${what}.trace`).map((t, i) => selectStep(t, `${what}.trace[${i}]`));
  if (!trace.length) bad(`${what}.trace is empty`);
  return {winner: side(b.winner, `${what}.winner`), endTurn: int(b.endTurn, `${what}.endTurn`), trace};
}

// Whitelisted lesson for one id. Validates the whole lesson, including branches, before any stage answers.
export function selectLesson(lessons, turnId) {
  const found = list(lessons, "top level").filter((l) => l && typeof l === "object" && l.id === turnId);
  if (!found.length) bad(`lesson ${turnId} is missing`);
  if (found.length > 1) bad(`lesson ${turnId} appears more than once`);
  const l = found[0];
  const board = obj(l.board, `${turnId}.board`);
  const bases = obj(l.bases, `${turnId}.bases`);
  const branches = obj(l.branches, `${turnId}.branches`);
  const lesson = {
    id: turnId,
    seed: int(l.seed, `${turnId}.seed`),
    board: {cowboy: text(board.cowboy, `${turnId}.board.cowboy`), wizard: text(board.wizard, `${turnId}.board.wizard`)},
    bases: {cowboy: int(bases.cowboy, `${turnId}.bases.cowboy`), wizard: int(bases.wizard, `${turnId}.bases.wizard`)},
    ownTraps: list(l.ownTraps, `${turnId}.ownTraps`).map((t, i) => text(t, `${turnId}.ownTraps[${i}]`)),
    branches: Object.fromEntries(LESSON_TARGETS.map((name) => [name, selectBranch(branches[name], `${turnId}.branches.${name}`)])),
  };
  // The decision turn is the first traced turn; both lines must start from the same Cowboy turn.
  const starts = LESSON_TARGETS.map((name) => lesson.branches[name].trace[0]);
  if (starts.some((s) => s.side !== "cowboy")) bad(`${turnId} trace does not start on a Cowboy turn`);
  if (starts.some((s) => s.turn !== starts[0].turn)) bad(`${turnId} branches start on different turns`);
  lesson.turn = starts[0].turn;
  return lesson;
}

// Stage one: position only. Stage two: both outcomes, chosen first, and the chosen trace.
export function lessonView(lesson, target) {
  const position = {
    turnId: lesson.id,
    turn: lesson.turn,
    seed: lesson.seed,
    seat: "cowboy",
    board: {cowboy: lesson.board.cowboy, wizard: lesson.board.wizard},
    bases: {cowboy: lesson.bases.cowboy, wizard: lesson.bases.wizard},
    ownTraps: [...lesson.ownTraps],
    allowedTargets: LESSON_TARGETS.map((id) => ({id, label: TARGET_LABELS[id]})),
  };
  if (target === undefined) return {stage: "choose", ...position, next: "Call again with the same turnId and target dragon or jack to see the recorded outcomes."};
  const other = LESSON_TARGETS.find((id) => id !== target);
  const outcome = (id) => ({target: id, label: TARGET_LABELS[id], winner: lesson.branches[id].winner, endTurn: lesson.branches[id].endTurn});
  return {
    stage: "review",
    ...position,
    chosen: target,
    source: LESSON_SOURCE,
    outcomes: [outcome(target), outcome(other)],
    trace: lesson.branches[target].trace.map((t) => ({...t})),
  };
}

// Reads the lesson file from the bound project root only. Returns {body} or {isError, body}.
export function replayLesson(root, unavailable, {turnId, target}) {
  const base = {tool: LESSON_TOOL.name, turnId, lessonsPath: LESSONS_PATH};
  if (unavailable || !root) return {isError: true, body: {...base, error: unavailable ?? "project not bound"}};
  let raw;
  try {
    raw = readFileSync(root + LESSONS_PATH, "utf8");
  } catch (error) {
    return {isError: true, body: {...base, error: error.code === "ENOENT" ? `lesson data missing: ${LESSONS_PATH} is absent in the bound project` : `lesson data unreadable (${error.code ?? "error"})`}};
  }
  let lessons;
  try { lessons = JSON.parse(raw); } catch { return {isError: true, body: {...base, error: `lesson data malformed: ${LESSONS_PATH} is not valid JSON`}}; }
  try {
    return {body: lessonView(selectLesson(lessons, turnId), target)};
  } catch (error) {
    if (error instanceof LessonDataError) return {isError: true, body: {...base, error: `lesson data malformed or missing: ${error.message}`}};
    throw error;
  }
}
