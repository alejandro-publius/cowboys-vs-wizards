// Read the control's live name. Replay and return destinations change during a duel.
export function bindBattleHud(root) {
  root.classList.add("sd-battle-hud");
  const controls = "#sd-home, #sd-restart:not([data-replay-choice]), header .book-launch, header .sd-open-gallery, .table-hand-rules > summary, [data-board-zone-details] > summary, [data-graveyard]";
  const tip = document.createElement("span");
  tip.id = "sd-hud-tip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  root.append(tip);
  let owner;

  function hide() {
    if (!owner) return;
    owner.removeAttribute("aria-describedby");
    owner = null;
    tip.hidden = true;
  }

  function show(control) {
    if (owner === control) return;
    hide();
    if (!control || control.disabled || control.closest("details[open]") || !root.classList.contains("sd-diorama")) return;
    owner = control;
    tip.textContent = control.getAttribute("aria-label") || control.textContent.trim();
    control.setAttribute("aria-describedby", tip.id);
    tip.hidden = false;
    const box = control.getBoundingClientRect();
    tip.style.left = Math.max(4, Math.min(box.left, innerWidth - tip.offsetWidth - 4)) + "px";
    tip.style.top = (box.top < innerHeight / 2 ? box.bottom : box.top - tip.offsetHeight) + "px";
  }

  root.addEventListener("focusin", (event) => show(event.target.matches(":focus-visible") && event.target.closest(controls)));
  root.addEventListener("focusout", hide);
  root.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "touch" && event.target !== tip) show(event.target.closest(controls));
  });
  root.addEventListener("pointerout", (event) => {
    if (owner && !owner.contains(event.relatedTarget) && event.relatedTarget !== tip && !owner.matches(":focus-visible")) hide();
  });
  root.addEventListener("click", hide, true);
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  root.addEventListener("keydown", (event) => {
    if (owner && event.key === "Escape") {
      hide();
      event.stopPropagation();
    }
  });
}
