import * as T from "three";
import { createSpellBrush } from "./spell-brush.js";
import { drawGearsAndSeals } from "./spell-gears-and-seals.js";
import { drawFrostAndStorm } from "./spell-frost-and-storm.js";
import { drawVoidPrismChains } from "./spell-void-prism-chains.js";

const smooth = T.MathUtils.smoothstep;
const pulse = (t, a, b, c) => smooth(t, a, b) * (1 - smooth(t, b, c));

export function createSpellStudyEffects(parent, camera, { at, movePawn }) {
  const brush = createSpellBrush(parent, camera);
  let source, target;
  return {
    clear() {
      brush.clear();
      source = target = null;
    },
    draw(step, actor, victim, t) {
      const name = step.spellStudy;
      const edge = step.contact / 1000;
      const age = t - edge;
      const direction = step.from.side === "wizard" ? -1 : 1;
      source ??= at(step.from, "staff-tip", 1.85).clone();
      target ??= at(step.targets[0], "hit", 1.06).clone();
      const charge = pulse(t, 0.08, edge - 0.42, edge + 0.19);
      const release = pulse(age, -0.19, 0.025, 0.53);
      movePawn(actor, -direction * 0.14 * charge + direction * 0.11 * release,
        -0.065 * charge, 0, direction * (charge * 0.15 - release * 0.23));
      brush.begin();
      const context = { source, target, t, edge };
      switch (name) {
        case "clockwork":
        case "scarlet":
        case "astral":
          drawGearsAndSeals(brush, name, context);
          break;
        case "frost":
        case "tempest":
          drawFrostAndStorm(brush, name, context);
          break;
        case "void":
        case "prism":
        case "chains":
          drawVoidPrismChains(brush, name, context);
          break;
      }
      if (age < 0 && victim) {
        const brace = smooth(age, -0.52, -0.10);
        const pull = name === "void" ? smooth(t, edge - 1.10, edge - 0.19) : 0;
        const bind = name === "chains" ? smooth(age, -0.39, -0.06) : 0;
        movePawn(victim, -direction * pull * 0.56, pull * 0.67 - brace * 0.10,
          -pull * 0.18, -direction * pull * 0.32 + direction * bind * 0.22);
        victim.rig?.pose({ brace: Math.max(brace * 0.72, bind), aim: 0.12 * brace });
      }
    },
    react(name, victim, age, dir) {
      if (age < 0) return;
      const hit = pulse(age, -0.018, 0.075, 0.44);
      const settle = pulse(age, -0.014, 0.21, 0.90);
      const suspended = (name === "void" ? 0.61 : name === "astral" ? 0.17 : 0.07) *
        (1 - smooth(age, 0, 0.29));
      const distance = name === "prism" ? 0.90 : name === "chains" ? 0.30 : 0.64;
      movePawn(victim, dir * settle * distance, suspended + hit * 0.11, -0.12 * hit, -dir * 0.42 * hit);
      victim.rig?.pose({ recoil: hit, brace: 0.77 * settle * (1 - hit) });
    },
  };
}
