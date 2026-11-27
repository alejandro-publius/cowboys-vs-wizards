// The visible hint mirrors a control's live name. Preserve its accessible name and any
// separate descriptions, including destinations that change during a duel.
export function bindBattleHud(root) {
  root.classList.add("sd-battle-hud");
  const controls = "#sd-home, #sd-restart:not([data-replay-choice]), header .book-launch, header .sd-open-gallery, .table-hand-rules > summary, [data-board-zone-details] > summary, [data-graveyard]";
  const tip = document.createElement("span");
  tip.id = "sd-hud-tip";
  tip.setAttribute("aria-hidden", "true");
  tip.hidden = true;
  root.append(tip);
  let owner;
  let nativeTitle;

  function hide() {
    if (!owner) return;
    if (nativeTitle && !owner.hasAttribute("title")) owner.title = nativeTitle;
    owner = null;
    nativeTitle = "";
    tip.hidden = true;
  }

  function show(control, pointerX) {
    if (owner === control) return;
    hide();
    if (!control || control.disabled || control.closest("details[open]") || !root.classList.contains("sd-diorama")) return;
    owner = control;
    tip.textContent = control.getAttribute("aria-label") || control.textContent.trim();
    if (control.title === tip.textContent) {
      nativeTitle = control.title;
      control.removeAttribute("title");
    }
    tip.hidden = false;
    const box = control.getBoundingClientRect();
    const anchor = pointerX ?? (box.left + box.width / 2);
    const left = Math.min(anchor - tip.offsetWidth / 2, innerWidth - tip.offsetWidth - 4);
    tip.style.left = Math.max(4, left) + "px";
    tip.style.top = (box.bottom + tip.offsetHeight + 4 <= innerHeight ? box.bottom : box.top - tip.offsetHeight) + "px";
  }

  root.addEventListener("focusin", (event) => show(event.target.matches(":focus-visible") && event.target.closest(controls)));
  root.addEventListener("focusout", hide);
  root.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "touch" && event.target !== tip) show(event.target.closest(controls), event.clientX);
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
