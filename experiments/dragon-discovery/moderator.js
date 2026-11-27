import {abandon, enroll, grade, newCohort, recordExplanation, stopTrial, summarize} from "./study.js";

const byId = id => document.getElementById(id);
const panel = byId("panel"), main = document.querySelector("main"), play = byId("play");
const status = byId("error"), download = byId("export");
const build = document.querySelector('[name="game-sha256"]').content;
const instrument = document.querySelector('[name="instrument-sha256"]').content;
const kind = location.search === "?check" ? "synthetic" : "human";
const key = "showdown-g10-v1-" + kind;
const game = JSON.parse(byId("game").textContent);
let cohort, frame, readyTimer, unsaved = false;
const last = () => cohort.trials.at(-1);

function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(cohort));
    status.textContent = "";
    unsaved = false;
  } catch {
    unsaved = true;
    status.textContent = "Browser storage failed. Keep this page open and download the observations before closing.";
  }
  return !unsaved;
}

download.onclick = () => {
  const report = {schema: "showdown-g10-v1", ...cohort, summary: summarize(cohort)};
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2) + "\n"], {type: "application/json"}));
  const a = document.createElement("a");
  a.href = url;
  a.download = `g10-${kind}-${cohort.build.slice(0, 12)}-${cohort.trials.length}-${last()?.status ?? "empty"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

function show(html) {
  main.hidden = false;
  play.hidden = true;
  panel.innerHTML = html;
  panel.querySelector("h2")?.focus();
}

function dropFrame() {
  clearTimeout(readyTimer);
  frame?.remove();
  frame = null;
}

function dashboard() {
  const summary = summarize(cohort);
  const sameBuild = cohort.build === build && cohort.instrument === instrument;
  const title = kind === "human" ? "First-time players" : "Synthetic instrument check";
  show(`<h2 tabindex="-1">${title}</h2><p>${summary.count} of 5 slots finished · ${summary.passed} met the criterion · ${summary.verdict}</p>
    <button id="prepare">Prepare the next title screen</button>`);
  const prepare = byId("prepare");
  prepare.hidden = summary.count === 5 || !sameBuild || unsaved;
  prepare.onclick = prepareTitle;
  if (!sameBuild) panel.append("The saved cohort belongs to another build. Export it here. Use a fresh study profile for a new cohort.");
}

function prepareTitle() {
  const confirm = kind === "human" ? "This is a consenting first-time player who has never taken this trial." : "This is an instrument check.";
  show(`<h2 tabindex="-1">Prepare slot ${cohort.trials.length + 1}</h2><form>
    <label><input type="checkbox" required> ${confirm}</label>
    <p>Read aloud exactly “Find out how to recruit the Dragon.”</p>
    <button id="start" disabled>Loading title…</button></form>`);
  frame = document.createElement("iframe");
  frame.title = "Cowboys vs. Wizards";
  frame.setAttribute("sandbox", "allow-scripts");
  frame.srcdoc = game;
  play.prepend(frame);
  readyTimer = setTimeout(() => {
    dropFrame();
    dashboard();
    status.textContent = "The illustrated title did not open. This slot has not started.";
  }, 30_000);
  panel.querySelector("form").onsubmit = event => {
    event.preventDefault();
    if (!frame || byId("start").disabled) return;
    enroll(cohort);
    if (!persist()) {
      cohort.trials.pop(); // The participant has not seen the title.
      dropFrame();
      dashboard();
      return;
    }
    main.hidden = true;
    play.hidden = false;
    frame.focus();
    frame.contentWindow.focus();
    frame.contentWindow.postMessage({g10: "start"}, "*");
  };
}

function interview() {
  show(`<h2 tabindex="-1">What did you find out?</h2><form>
    <label>Player’s own words<textarea name="quote" rows="4" maxlength="4000"></textarea></label>
    <p>Transcribe verbatim, omitting identifying details. Leave blank for no response. Have the participant step away before scoring.</p>
    <label>Was any help given before or during their explanation?
      <select name="help" required><option value="">Choose…</option><option value="no">No</option><option value="yes">Yes</option></select></label>
    <label>Moderator observation (optional)<textarea name="notes" rows="2" maxlength="2000" placeholder="Where they stopped, or help given"></textarea></label>
    <button>Lock interview for private scoring</button></form>`);
  panel.querySelector("form").onsubmit = event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    recordExplanation(last(), data.get("quote"), data.get("help") === "yes", data.get("notes"));
    persist();
    rubric();
  };
}

function rubric() {
  const answer = (id, question) => `<label>${question}
    <select name="${id}" required><option value="">Choose…</option><option value="yes">Yes</option><option value="no">No</option></select></label>`;
  show(`<h2 tabindex="-1">Moderator scoring · slot ${last().slot}</h2><blockquote></blockquote><form>
    ${answer("practice", "Did the player explain that scouting is free practice?")}
    ${answer("hunts", "Did the player explain that winning five real Dragon hunts earns the card?")}
    <p>Accept equivalent wording. Mark an omitted, ambiguous or contradicted point No.</p>
    <button>Save final score</button></form>`);
  panel.querySelector("blockquote").textContent = last().explanation || "(No response)";
  panel.querySelector("form").onsubmit = event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    grade(last(), data.get("practice") === "yes", data.get("hunts") === "yes");
    persist();
    dashboard();
  };
}

window.addEventListener("message", ({source, origin, data}) => {
  if (!frame || source !== frame.contentWindow || origin !== "null") return;
  if (data?.g10 === "ready" && byId("start")?.disabled) {
    clearTimeout(readyTimer);
    byId("start").disabled = false;
    byId("start").textContent = "Start on the title";
  } else if (last()?.status === "active" && ["choice", "miss", "timeout"].includes(data?.g10)) {
    stopTrial(last(), data.g10, data.elapsedMs, data.choice);
    persist();
    dropFrame();
    interview();
  }
});
byId("end").onclick = () => frame?.contentWindow.postMessage({g10: "stop"}, "*");

async function openStudy() {
  if (!(location.protocol === "file:" || ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname))
      || !["", "?check"].includes(location.search)) throw new Error("Open the local study file or its loopback URL. Use ?check for rehearsals.");
  if (!navigator.locks) throw new Error("Open this local file in Chrome with browser storage available.");
  await navigator.locks.request(key, {ifAvailable: true}, async lock => {
    if (!lock) throw new Error("This cohort is open in another tab. Close that tab and reload this one.");
    const saved = localStorage.getItem(key);
    cohort = saved === null ? {...newCohort(kind, build), instrument, cohortId: crypto.randomUUID()} : JSON.parse(saved);
    summarize(cohort);
    if (cohort.kind !== kind) throw new Error("The saved cohort has the wrong observation type.");
    download.hidden = false;
    if (cohort.build !== build || cohort.instrument !== instrument) dashboard();
    else {
      if (last()?.status === "active") abandon(last());
      persist();
      if (last()?.status === "interview") interview();
      else if (last()?.status === "rubric") rubric();
      else dashboard();
    }
    await new Promise(resolve => window.addEventListener("pagehide", resolve, {once: true}));
  });
}
window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
openStudy().catch(error => { status.textContent = error.message; });
