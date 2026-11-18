// Behavior of the one-decision Ride Out playtest page. The build inlines this
// file (scripts/build-ride-out-playtest.mjs). Local only: no storage, network
// or form. performance.now() measures the time to decision.
"use strict";
const byId = (id) => document.getElementById(id);
const choices = [...document.querySelectorAll("button[data-line]")];
const lines = byId("lines");
const articles = [...lines.querySelectorAll("article[data-line]")];
const note = byId("note");
let shownAt = performance.now();
let chosen = null;

// The choice and its time are fixed until Start over.
function choose(button) {
  if (chosen !== null) return;
  chosen = button.dataset.line;
  const seconds = (performance.now() - shownAt) / 1000;
  for (const each of choices) {
    each.disabled = true;
    each.setAttribute("aria-pressed", String(each === button));
  }
  byId("locked-line").textContent = button.dataset.title;
  byId("locked-time").textContent = seconds.toFixed(1);
  byId("locked").hidden = false;
  byId("locked-heading").focus();
}

// The note is locked as typed, or skipped, before any outcome is shown.
function reveal(keepNote) {
  if (chosen === null || !byId("outcome").hidden) return;
  if (keepNote && note.value.trim() !== "") {
    note.readOnly = true;
    byId("note-status").textContent = "Your note was locked before the reveal.";
  } else {
    note.value = "";
    byId("note-field").hidden = true;
    byId("note-status").textContent = "No note was written before the reveal.";
  }
  byId("reveal").disabled = true;
  byId("skip").disabled = true;
  for (const article of articles) {
    article.querySelector(".role").textContent = article.dataset.line === chosen ? "Your line" : "The other line";
  }
  lines.prepend(articles.find((article) => article.dataset.line === chosen));
  byId("outcome").hidden = false;
  byId("outcome-heading").focus();
}

function reset() {
  chosen = null;
  for (const each of choices) {
    each.disabled = false;
    each.setAttribute("aria-pressed", "false");
  }
  for (const id of ["locked-line", "locked-time", "note-status"]) byId(id).textContent = "";
  note.value = "";
  note.readOnly = false;
  byId("note-field").hidden = false;
  byId("reveal").disabled = false;
  byId("skip").disabled = false;
  byId("locked").hidden = true;
  byId("outcome").hidden = true;
  for (const article of articles) lines.append(article);
  shownAt = performance.now();
  byId("board-heading").focus();
}

for (const button of choices) button.addEventListener("click", () => choose(button));
byId("reveal").addEventListener("click", () => reveal(true));
byId("skip").addEventListener("click", () => reveal(false));
byId("reset").addEventListener("click", reset);
