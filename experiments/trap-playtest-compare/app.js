// Issue #124: local page for compare.js. Reads only the two files the user
// chooses, with the File API, after the Compare button is pressed. Renders
// with textContent only: no innerHTML, upload, fetch, storage or cookies.
import { CompareError, NOTE_FIELDS, NOTE_LABELS, SCENARIO_ORDER, compareReports, countRows } from "./compare.js";

const MAX_BYTES = 1024 * 1024;
const $ = (id) => document.getElementById(id);
const el = (tag, text) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  return node;
};
// A table row: all <th scope="col"> for a header, else a row header then <td> cells.
const row = (cells, header = false) => {
  const tr = el("tr");
  cells.forEach((cell, i) => {
    const th = header || i === 0;
    const node = el(th ? "th" : "td", cell);
    if (th) node.scope = header ? "col" : "row";
    tr.append(node);
  });
  return tr;
};

async function readChosen(input, label) {
  const file = input.files?.[0];
  if (!file) throw new CompareError(`${label}: choose a file`);
  if (file.size > MAX_BYTES) throw new CompareError(`${label}: larger than ${MAX_BYTES} bytes; not a lab report`);
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new CompareError(`${label}: is not valid JSON`);
  }
}

function render(c) {
  $("summary").replaceChildren(
    el("li", `Seed: ${c.seed}`),
    el("li", `Wizard CPU: ${c.wizardCpu}`),
    el("li", `Completeness: ${c.completeness}`),
    el("li", `Interpretation: ${c.interpretation}`),
    ...(c.comparison
      ? [
          el("li", `Same outcome: ${c.comparison.sameOutcome ? "yes" : "no"}`),
          el("li", `Same ending reason: ${c.comparison.sameReason ? "yes" : "no"}`),
          el("li", `Ending round, T1 minus BASE: ${c.comparison.endingRoundDelta > 0 ? "+" : ""}${c.comparison.endingRoundDelta}`),
        ]
      : [el("li", "Outcome and ending-round comparison: not computed (interpretation blocked).")]),
  );
  $("match-table").tBodies[0].replaceChildren(
    ...SCENARIO_ORDER.map((s) => {
      const r = c.reports[s];
      const res = r.match.result;
      return row([s, r.match.status, r.match.round ?? "-", res?.outcome ?? "-", res?.reason ?? "-", res?.round ?? "-"]);
    }),
  );
  const delta = c.comparison !== null;
  $("count-table").tHead.replaceChildren(row(["Count", "Side", "T1", "BASE", ...(delta ? ["T1 - BASE"] : [])], true));
  $("count-table").tBodies[0].replaceChildren(
    ...countRows(c).map(([label, side, a, b, d]) => row([label, side, a, b, ...(delta ? [d > 0 ? `+${d}` : d] : [])])),
  );
  $("limit-table").tBodies[0].replaceChildren(
    ...SCENARIO_ORDER.map((s) => {
      const l = c.reports[s].limits;
      return row([s, l.eventsTruncated ? "yes" : "no", l.eventsDropped, l.publicEventsIncluded ? "yes (not copied)" : "no"]);
    }),
  );
  $("warnings").replaceChildren(...c.warnings.map((w) => el("li", w)));
  const notes = $("notes");
  notes.hidden = !c.notes;
  $("notes-body").replaceChildren();
  if (c.notes) {
    for (const s of SCENARIO_ORDER) {
      const list = el("dl");
      for (const f of NOTE_FIELDS) list.append(el("dt", NOTE_LABELS[f]), el("dd", c.notes[s][f] || "(empty)"));
      $("notes-body").append(el("h4", s), list);
    }
  }
  $("result").hidden = false;
}

$("compare-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("compare");
  button.disabled = true;
  $("error").hidden = true;
  $("error").textContent = "";
  $("result").hidden = true;
  $("status").textContent = "Comparing…";
  try {
    const first = await readChosen($("first-file"), "first file");
    const second = await readChosen($("second-file"), "second file");
    const c = compareReports(first, second, { includeNotes: $("include-notes").checked });
    render(c);
    $("status").textContent = `Compared T1 and BASE for seed ${c.seed}, Wizard CPU ${c.wizardCpu}: ${c.completeness}.`;
  } catch (error) {
    $("error").textContent = error instanceof CompareError ? `Cannot compare: ${error.message}` : "Cannot compare: unexpected error.";
    $("error").hidden = false;
    $("status").textContent = "Comparison failed.";
  } finally {
    button.disabled = false;
  }
});
