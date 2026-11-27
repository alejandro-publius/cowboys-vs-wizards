// Appended only to the study's sandboxed copy of the illustrated game.
(() => {
  const limit = 60_000;
  const deals = ["dragon-c5", "dragon-c5-70"];
  let phase = "loading", activeMs = 0, visibleSince = null, timer;

  const send = (data) => parent.postMessage(data, "*");
  const elapsed = (at) => activeMs + (visibleSince === null ? 0 : at - visibleSince);
  function finish(g10, ms, choice) {
    phase = "finished";
    clearTimeout(timer);
    if (ms > limit) send({g10: "timeout", elapsedMs: limit});
    else send({g10, elapsedMs: Math.ceil(ms), ...(choice && {choice})});
  }

  function updateClock() {
    if (phase !== "running") return;
    clearTimeout(timer);
    const now = performance.now();
    activeMs = elapsed(now);
    visibleSince = !document.hidden && document.hasFocus() ? now : null;
    if (activeMs > limit) finish("timeout", activeMs);
    else if (visibleSince !== null) timer = setTimeout(updateClock, Math.floor(limit - activeMs) + 1);
  }
  document.addEventListener("visibilitychange", updateClock);
  window.addEventListener("focus", updateClock);
  window.addEventListener("blur", updateClock);
  window.addEventListener("message", ({source, data}) => {
    if (source !== parent || parent === window) return;
    if (phase === "ready" && data?.g10 === "start") {
      phase = "running";
      updateClock();
    } else if (phase === "running" && data?.g10 === "stop") {
      finish("miss", elapsed(performance.now()));
    }
  });

  // Keep links in this fresh frame. The game's click handlers still run for its own destinations.
  for (const type of ["click", "auxclick", "contextmenu", "dragstart"]) {
    document.addEventListener(type, (event) => {
      if (event.target.closest?.("a[href]")) event.preventDefault();
    }, true);
  }

  // Bubble after the room's choose() has accepted this trusted activation. Use the input timestamp
  // so rendering the recorded outcomes does not add to the participant's decision time.
  document.addEventListener("click", (event) => {
    if (phase !== "running" || visibleSince === null || document.hidden || !event.isTrusted || event.timeStamp < visibleSince) return;
    const room = document.querySelector("#replay-room:not([hidden])");
    if (!room || room.querySelector("#replay-room-back")?.textContent !== "Back to Wanted") return;
    const button = event.target.closest?.('.rr-choices button[data-branch]:disabled[aria-pressed="true"]');
    if (!button || !room.contains(button)) return;
    const target = button.dataset.branch;
    const table = room.querySelector('.rr-deals button[aria-pressed="true"]')?.dataset.deal;
    if ((table !== "0" && table !== "1") || (target !== "dragon" && target !== "jack")) return;
    finish("choice", elapsed(event.timeStamp), {deal: deals[Number(table)], target});
  });

  const mounted = new MutationObserver(checkTitle);
  function checkTitle() {
    const title = document.querySelector("#title-screen:not([hidden])");
    if (!title || !["#menu-saloon", "#menu-challenge", "#menu-play"].every(id => title.querySelector(id))) return;
    mounted.disconnect();
    phase = "ready";
    send({g10: "ready"});
  }
  mounted.observe(document.documentElement, {subtree: true, childList: true});
  checkTitle();
})();
