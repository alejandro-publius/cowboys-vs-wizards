import * as T from "three";
import { LOOK } from "../../../prototypes/showdown/art.js";
import { EFFECTS, TYPES } from "../../game/showdown/cards.js";
import { opponent } from "../../game/showdown/rules.js";
import { makeCardModel } from "./card-models.js";
import { PixelRenderer } from "./graphics/pixel-renderer.js";
import { attackExample, attackPreviews } from "./attack-preview.js";
import { presentationBeats } from "./event-positions.js";
import { replayCards } from "./replay-cards.js";

export const ROSTER = Object.keys(TYPES);
const order = new Map(ROSTER.map((id, i) => [id, i]));
const troopRoster = ROSTER.filter((id) => TYPES[id].kind === "troop");
const sideName = { cowboy: "Cowboys", wizard: "Wizards" };
const kinds = { troop: "Troop", spell: "Spell", trap: "Trap", gear: "Gear", location: "Location" };
const atlas = typeof __CVW_DIORAMA_ATLAS__ === "undefined" ? "" : __CVW_DIORAMA_ATLAS__;

export function portrait(id) {
  if (!atlas) return null;
  const image = document.createElement("span");
  image.className = "sd-card-art";
  image.setAttribute("aria-hidden", "true");
  const i = order.get(id);
  image.style.backgroundPosition = `${(i % 6) * 20}% ${Math.floor(i / 6) * 20}%`;
  return image;
}

function stage(canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.setPixelRatio(1);
  const pipeline = new PixelRenderer(renderer);
  pipeline.configure({ pixelSize: 2, outlines: true, dither: true, exposure: 1.03 });
  const scene = new T.Scene();
  const pedestal = new T.Mesh(
    new T.CylinderGeometry(1.52, 1.61, 0.161, 12),
    new T.MeshStandardMaterial({ color: 0x78504a, roughness: 0.94 }),
  );
  pedestal.position.y = -0.091;
  scene.add(pedestal);
  const key = new T.DirectionalLight(0xffddaa, 2.8);
  key.position.set(-3.8, 5.4, 4.3);
  const rim = new T.DirectionalLight(0x8079df, 1.5);
  rim.position.set(4.5, 4, -6.2);
  scene.add(new T.HemisphereLight(0xffe6d8, 0x615680, 2.31), key, rim);
  const camera = new T.OrthographicCamera(-3, 3, 2, -2, 0.08, 40);
  const focal = new T.Vector3(0, 1.06, 0);
  let model,
    current,
    angle = 0.36;
  function draw() {
    if (!model || !canvas.clientWidth) return;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (w !== canvas.width || h !== canvas.height) {
      renderer.setSize(w, h, false);
      pipeline.setSize(w, h);
    }
    const aspect = w / h;
    const half = Math.max(1.61, 1.75 / aspect);
    Object.assign(camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
    camera.position.set(7.8 * Math.sin(angle), 3.38, 7.8 * Math.cos(angle)).add(focal);
    camera.lookAt(focal);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    pipeline.render(scene, camera);
  }
  new ResizeObserver(draw).observe(canvas);
  return {
    select(id) {
      current = id;
      if (model) scene.remove(model);
      model = makeCardModel(id, { width: 2.76, height: 2.47, depth: 2.64 });
      scene.add(model);
      const bounds = new T.Box3().setFromObject(model);
      focal.y = Math.min(1.17, (bounds.max.y + bounds.min.y) * 0.48 + 0.08);
      const western = TYPES[id].side === "cowboy";
      scene.background = new T.Color(western ? 0x68494a : 0x343452);
      pedestal.material.color.setHex(western ? 0x966747 : 0x636587);
      draw();
    },
    rotate(yaw) {
      angle = yaw;
      if (current) draw();
    },
  };
}

export function mountGallery(title, duel, makeAttackStage) {
  if (atlas)
    document.documentElement.style.setProperty("--sd-card-atlas", `url("data:image/webp;base64,${atlas}")`);
  const dialog = document.createElement("dialog");
  dialog.className = "sd-gallery";
  dialog.setAttribute("aria-labelledby", "sd-gallery-heading");
  dialog.innerHTML = `
    <header class="sd-gallery-head"><h2 id="sd-gallery-heading">Card gallery</h2><button type="button" class="sd-gallery-close">Close</button></header>
    <div class="sd-gallery-grid">
      <div class="sd-gallery-menu"></div>
      <section class="sd-gallery-main">
        <header class="sd-gallery-info"><div><h3></h3><p class="sd-gallery-type"></p></div><div class="sd-gallery-nav"><button type="button" data-step="-1" aria-label="Previous card">‹</button><button type="button" data-step="1" aria-label="Next card">›</button></div></header>
        <canvas class="sd-gallery-model" aria-hidden="true"></canvas>
        <div class="sd-gallery-still" hidden></div>
        <label class="sd-gallery-angle">Rotate <input type="range" min="-180" max="180" value="20" aria-label="Rotate the card model"></label>
        <div class="sd-gallery-actions">
          <div class="sd-gallery-moves"></div>
          <button type="button" class="sd-gallery-reel">Watch all troops</button>
        </div>
        <div class="sd-gallery-attack" hidden>
          <canvas class="sd-attack-world" aria-label="Attack replay. Drag to orbit and scroll to zoom." tabindex="0" hidden></canvas>
          <div class="sd-world-labels" aria-hidden="true"></div>
          <div class="sd-replay-cards" hidden></div>
        </div>
        <p class="sd-attack-result" role="status" hidden></p>
        <p class="sd-gallery-rule"></p>
        <p class="sd-gallery-subject"></p>
        <p class="sd-gallery-story"></p>
        <p class="sd-gallery-cue"></p>
      </section>
    </div>`;
  document.body.append(dialog);
  const heading = dialog.querySelector("#sd-gallery-heading");
  const close = dialog.querySelector(".sd-gallery-close");
  const menu = dialog.querySelector(".sd-gallery-menu");
  const canvas = dialog.querySelector("canvas");
  const still = dialog.querySelector(".sd-gallery-still");
  const attackHost = dialog.querySelector(".sd-gallery-attack");
  const attackCanvas = attackHost.querySelector("canvas");
  const attackResult = dialog.querySelector(".sd-attack-result");
  const cards = dialog.querySelector(".sd-replay-cards");
  const attackMoves = dialog.querySelector(".sd-gallery-moves");
  const reel = dialog.querySelector(".sd-gallery-reel");
  const choices = new Map();
  for (const [side, heading] of Object.entries(sideName)) {
    const group = document.createElement("section");
    const h = document.createElement("h3");
    h.textContent = heading;
    group.append(h);
    for (const id of ROSTER.filter((id) => TYPES[id].side === side)) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.art = id;
      button.textContent = TYPES[id].name;
      button.onclick = () => select(id);
      choices.set(id, button);
      group.append(button);
    }
    menu.append(group);
  }
  let preview,
    battle,
    replaySource,
    contactTimer,
    battleUnavailable = false,
    reelTimer,
    playingAll = false,
    hasModel = true,
    active = ROSTER[0];
  function stopReel() {
    window.clearTimeout(reelTimer);
    playingAll = false;
    reel.textContent = "Watch all troops";
  }
  function restoreModel() {
    window.clearTimeout(contactTimer);
    cards.hidden = true;
    battle?.clear();
    attackHost.hidden = attackResult.hidden = true;
    angle.closest("label").hidden = canvas.hidden = !hasModel || TYPES[active].kind !== "troop";
    still.hidden = !still.firstChild;
  }
  function animateBattle(id, mode, example, finished) {
    battle ??= makeAttackStage(attackHost, attackCanvas, dialog);
    const troopZoom = replaySource ? 2.05 : 1.63;
    const zoom = id === "wizard-singularity" ? 1.34 : mode === "ride" ? 1.17 : troopZoom;
    battle.frame(zoom);
    attackHost.dataset.spell = id === "wizard-singularity" ? "singularity" : id === "wizard-hellfire" ? "hellfire" : "";
    if (id === "wizard-singularity") {
      const side = mode === "sheriffs" ? "cowboy" : "wizard";
      battle.lookAt(side === "cowboy" ? [-1.65, 0.98, 0.8] : [2.1, 1.02, 0.65], side === "cowboy" ? 0.61 : -0.33, 0.68);
    }
    if (id === "wizard-hellfire") battle.lookAt([-2.2, 2.0, 0.5], 0.66, 0.51);
    battle.paint(example.end, example.before);
    battle.animate(example.trace, finished);
  }
  function playPortraits(id, example, pieces, reduced, finished) {
    battle?.clear();
    attackCanvas.hidden = true;
    cards.hidden = false;
    cards.dataset.state = "before";
    const labels = [];
    let baseOrbs;
    cards.replaceChildren(...pieces.map(piece => {
      const figure = document.createElement("figure");
      if (piece.id) {
        const face = portrait(piece.id);
        if (face) figure.append(face);
      } else {
        baseOrbs = document.createElement("span");
        baseOrbs.className = "sd-orbs";
        baseOrbs.setAttribute("aria-hidden", "true");
        figure.append(baseOrbs);
      }
      const caption = document.createElement("figcaption");
      const state = document.createElement("strong");
      caption.append(piece.name, state);
      figure.append(caption);
      labels.push(state);
      return figure;
    }));
    function display(next, view) {
      if (baseOrbs) {
        const {base, baseMax} = view.sides[opponent(example.before.active)];
        baseOrbs.textContent = "●".repeat(base) + "○".repeat(baseMax - base);
      }
      next.forEach(({before, after}, i) => {
        labels[i].textContent = before === after ? after : before + " → " + after;
        labels[i].closest("figure").classList.toggle("defeated", after === "Defeated");
      });
    }
    function end() {
      cards.dataset.state = "after";
      display(pieces, example.end);
      finished();
    }
    if (reduced) return end();
    display(replayCards(id, example, example.before).pieces, example.before);
    const beats = presentationBeats(example.trace);
    function contact(i) {
      const beat = beats[i];
      if (!beat) return end();
      contactTimer = window.setTimeout(() => {
        display(replayCards(id, example, beat.hit).pieces, beat.hit);
        contactTimer = window.setTimeout(() => contact(i + 1), beat.duration - beat.contact);
      }, beat.contact);
    }
    contact(0);
  }
  function watch(id, mode, finished) {
    const example = attackExample(id, mode);
    if (!example) return;
    window.clearTimeout(contactTimer);
    attackResult.hidden = false;
    const direct = dialog.classList.contains("book-replay");
    const snapshot = direct ? replayCards(id, example) : null;
    if (direct) {
      const [actor, ...targets] = snapshot.pieces;
      const target = targets.length === 1 ? targets[0].name : targets.length + " targets";
      attackResult.textContent = actor.name + " vs. " + target;
      for (const button of attackMoves.children) {
        const selected = button.dataset.attackMode === mode;
        button.setAttribute("aria-pressed", String(selected));
        button.textContent = (selected ? "Replay " : "Play ") + button.dataset.moveName;
      }
    } else attackResult.textContent = example.summary;
    const complete = () => {
      if (direct) attackResult.textContent = snapshot.outcome;
      finished?.();
    };
    const reduced = direct && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    attackCanvas.dataset.cardArt = id;
    attackCanvas.dataset.previewMode = mode;
    cards.hidden = true;
    attackHost.hidden = false;
    if (!reduced && !(direct && battleUnavailable)) {
      try {
        animateBattle(id, mode, example, complete);
        canvas.hidden = still.hidden = angle.closest("label").hidden = true;
        return;
      } catch {
        if (!direct) {
          attackHost.hidden = true;
          stopReel();
          return;
        }
        battleUnavailable = true;
      }
    }
    canvas.hidden = still.hidden = angle.closest("label").hidden = true;
    playPortraits(id, example, snapshot.pieces, reduced, complete);
  }
  function playReel(index) {
    if (!playingAll || !dialog.open) return;
    if (index === troopRoster.length) return stopReel();
    const id = troopRoster[index];
    select(id, true);
    watch(id, attackPreviews(id)[0][0], () => {
      if (playingAll) reelTimer = window.setTimeout(() => playReel(index + 1), 460);
    });
  }
  function setMoves(id) {
    attackMoves.replaceChildren(...attackPreviews(id).map(([mode, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.attackMode = mode;
      button.dataset.moveName = label.replace(/^Watch /, "").replace(/^Against /, "vs. ");
      button.textContent = label;
      button.onclick = () => {
        stopReel();
        watch(id, mode);
      };
      return button;
    }));
  }
  function select(id, fromReel = false) {
    if (!fromReel) stopReel();
    restoreModel();
    const card = TYPES[id];
    choices.get(active).setAttribute("aria-pressed", "false");
    active = id;
    choices.get(id).setAttribute("aria-pressed", "true");
    canvas.dataset.cardArt = id;
    dialog.querySelector(".sd-gallery-info h3").textContent = card.name;
    dialog.querySelector(".sd-gallery-type").textContent = sideName[card.side] + " · " + kinds[card.kind];
    dialog.querySelector(".sd-gallery-rule").textContent =
      card.kind === "troop" ? card.attack + " attack · " + card.health + " orbs" : EFFECTS[card.effect].text;
    dialog.querySelector(".sd-gallery-subject").textContent = LOOK[id].subject;
    dialog.querySelector(".sd-gallery-story").textContent = LOOK[id].scene;
    dialog.querySelector(".sd-gallery-cue").textContent = LOOK[id].cue;
    setMoves(id);
    const usePortrait = !hasModel || card.kind !== "troop";
    angle.closest("label").hidden = canvas.hidden = usePortrait;
    const art = usePortrait ? portrait(id) : null;
    still.hidden = !art;
    still.replaceChildren(...(art ? [art] : []));
    if (!usePortrait) preview?.select(id);
  }
  const angle = dialog.querySelector("input");
  angle.oninput = () => preview?.rotate(T.MathUtils.degToRad(Number(angle.value)));
  for (const button of dialog.querySelectorAll("[data-step]"))
    button.onclick = () =>
      select(ROSTER[(order.get(active) + Number(button.dataset.step) + ROSTER.length) % ROSTER.length]);
  close.onclick = () => dialog.close();
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") event.stopPropagation();
  });
  reel.onclick = () => {
    if (playingAll) {
      stopReel();
      restoreModel();
      return;
    }
    playingAll = true;
    reel.textContent = "Stop reel";
    playReel(0);
  };
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    stopReel();
    restoreModel();
    dialog.classList.remove("book-replay");
    heading.textContent = "Card gallery";
    close.textContent = "Close";
    attackCanvas.tabIndex = 0;
    attackCanvas.removeAttribute("aria-hidden");
    replaySource?.focus({preventScroll: true});
    replaySource = null;
  });
  function open() {
    dialog.showModal();
    if (!preview) {
      try {
        preview = stage(canvas);
      } catch {
        hasModel = false;
      }
    }
    select(active);
  }
  for (const anchor of [title.querySelector(".title-scene"), duel.querySelector("header")]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sd-open-gallery";
    button.textContent = "Card gallery";
    button.onclick = open;
    if (anchor.parentElement === duel) anchor.insertBefore(button, anchor.querySelector("#sd-home"));
    else anchor.append(button);
  }
  if (new URLSearchParams(location.search).get("gallery") === "1") open();
  return function openReplay(id) {
    const moves = attackPreviews(id);
    if (!moves.length) return;
    replaySource = document.activeElement;
    dialog.classList.add("book-replay");
    heading.textContent = id === "wizard-singularity" ? TYPES[id].name + " · Area preview" : TYPES[id].name;
    close.textContent = "Back to book";
    stopReel();
    setMoves(id);
    attackCanvas.removeAttribute("tabindex");
    attackCanvas.setAttribute("aria-hidden", "true");
    dialog.showModal();
    attackMoves.firstElementChild.focus({preventScroll: true});
    watch(id, moves[0][0]);
  };
}
