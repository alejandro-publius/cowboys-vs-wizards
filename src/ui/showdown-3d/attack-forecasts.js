// The graybox target owns the forecast and the attack. The illustrated table reads both from that button.
export function bindAttackForecasts(root, choices) {
  const board = root.querySelector("#sd-board");
  const note = document.createElement("p");
  note.className = "table-forecast-note";
  note.setAttribute("aria-hidden", "true");
  const compare = document.createElement("button");
  compare.type = "button";
  compare.className = "table-compare";
  compare.setAttribute("aria-haspopup", "dialog");
  choices.prepend(note, compare);

  const dialog = document.createElement("dialog");
  dialog.id = "sd-attack-forecasts";
  dialog.className = "table-forecast-dialog";
  dialog.setAttribute("aria-labelledby", "table-forecast-title");
  compare.setAttribute("aria-controls", dialog.id);
  dialog.innerHTML = '<h2 id="table-forecast-title">Choose an attack target</h2><div class="table-target-list"></div><button type="button" class="table-back">Back to board</button>';
  root.append(dialog);
  const list = dialog.querySelector(".table-target-list");
  let targets = [];

  function clear() {
    if (dialog.open) dialog.close();
    list.replaceChildren();
    targets = [];
    note.hidden = compare.hidden = true;
    note.textContent = compare.textContent = "";
  }

  function label(target) {
    const repeated = targets.some((other) => other !== target && other.name === target.name);
    return repeated ? `${target.name} · Slot ${Number(target.button.dataset.enemy) + 1}` : target.name;
  }

  function showTarget(target) {
    note.textContent = target ? `${label(target)} · ${target.forecast}` : "";
    note.hidden = !target;
  }

  function paint() {
    clear();
    for (const button of board.querySelectorAll("button[data-enemy]")) {
      const forecast = button.querySelector('[id^="sd-preview-"]');
      if (forecast) targets.push({button, name: button.querySelector("strong").textContent, forecast: forecast.textContent});
    }
    compare.hidden = targets.length < 2;
    if (!compare.hidden) compare.textContent = `Compare ${targets.length} targets`;
    if (targets.length === 1) showTarget(targets[0]);
  }

  function previewAt(event) {
    if (targets.length < 2) return;
    const button = event.target.closest("button[data-enemy]");
    showTarget(targets.find((target) => target.button === button));
  }
  board.addEventListener("focusin", previewAt);
  board.addEventListener("pointerover", previewAt);
  board.addEventListener("pointerleave", () => {
    if (targets.length > 1) showTarget(targets.find((target) => target.button === document.activeElement));
  });
  board.addEventListener("focusout", (event) => {
    if (targets.length > 1 && !board.contains(event.relatedTarget)) showTarget(null);
  });

  compare.onclick = (event) => {
    event.stopPropagation();
    list.replaceChildren();
    for (const target of targets) {
      const option = document.createElement("button");
      option.type = "button";
      const name = document.createElement("strong");
      name.textContent = label(target);
      const forecast = document.createElement("span");
      forecast.textContent = target.forecast;
      option.append(name, forecast);
      option.onclick = (click) => {
        click.stopPropagation();
        dialog.close();
        target.button.click();
      };
      list.append(option);
    }
    dialog.showModal();
  };
  dialog.querySelector(".table-back").onclick = (event) => {
    event.stopPropagation();
    dialog.close();
  };
  // Escape closes the comparison first. The duel's Escape handler can then cancel the actual attack pick.
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") event.stopPropagation();
  });
  dialog.addEventListener("close", () => {
    if (!dialog.open) list.replaceChildren();
  });
  clear();
  return {paint, clear};
}
