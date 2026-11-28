import { Vector3, MathUtils } from "three";

const smooth = MathUtils.smoothstep;
const gold = [0xffeabd, 0xe8a558, 0xffce83];
const violet = [0xecd8ff, 0xb48aca, 0x765c91];

export function drawBearTrap({ prop, foot, target, step, t, edge, dot, impactSparks }) {
  const age = t - edge;
  const snap = smooth(age, -0.085, 0);
  const bounce = 0.12 * Math.sin(smooth(age, 0.014, 0.18) * Math.PI);
  prop.getObjectByName("pressure-plate").position.y = 0.19 - 0.09 * smooth(age, -0.18, -0.08);
  for (const side of [-1, 1]) {
    prop.getObjectByName("iron-jaw-" + side).rotation.x = -side * (0.12 + 1.27 * snap - bounce);
  }
  if (age < 0) return;
  const contact = foot.clone().add(new Vector3(0, 0.35, 0.43));
  if (age < 0.18) impactSparks(contact, age * 1.9, gold, 1.15);
  // Show exactly the pips removed by the public contact snapshot, capped by the troop's life.
  const lost = step.receiver[0].hp - step.left;
  const fade = 1 - smooth(age, 0.12, 0.38);
  if (!fade) return;
  for (let i = 0; i < lost; i++) {
    const sign = i === 0 ? -1 : 1;
    const orb = foot.clone().add(new Vector3(sign * (0.22 + 1.7 * age), 0.22 + 3.5 * age - 5 * age * age, 0.84));
    const size = 0.33 * fade;
    dot("shard", target.side === "wizard" ? 0x8be3da : 0xffb85e, orb, size, size, size, 0, age * 5, (i + 1) * Math.PI / 5);
  }
}

export function drawHex({ prop, foot, target, victim, muzzle, t, edge, dot, bar, movePawn }) {
  const age = t - edge;
  const dir = target.side === "cowboy" ? 1 : -1;
  const reach = smooth(t, 0.14, edge - 0.10);
  const recover = 1 - smooth(age, 0.20, 0.46);
  // Start a thrust, arrest it for a readable hold, then release the attacker back to rest.
  const hold = reach * recover;
  movePawn(victim, dir * 0.39 * hold, 0, 0, -dir * 0.18 * hold);
  prop.getObjectByName("cloth-charm").rotation.z = -dir * 1.03 * smooth(age, -0.13, 0.07);
  for (let i = 0; i < 5; i++) {
    const flame = prop.getObjectByName("candle-flame-" + i);
    const lit = 1 - smooth(age, -0.22 + i * 0.016, i * 0.012);
    flame.scale.set(lit, lit * (1 + 0.11 * Math.sin(t * 25 + i)), lit);
    flame.visible = lit > 0.03;
  }
  // Two broken chalk crescents tighten against the shadow. Leave the Wraith its five-point seal.
  const chalk = smooth(t, 0.21, edge - 0.06) * (1 - smooth(age, 0.13, 0.42));
  if (chalk > 0) {
    const radius = 1.42 - 0.35 * smooth(age, -0.15, 0.055);
    const point = (a) => foot.clone().add(new Vector3(Math.cos(a) * radius, 0.16, Math.sin(a) * radius * 0.83));
    for (const turn of [0, Math.PI]) {
      for (let i = 0; i < 6; i++) {
        const start = turn - 0.96 + i * 0.32;
        bar(point(start), point(start + 0.29 * chalk), violet[i % 3], 0.12 * chalk);
      }
    }
  }
  const length = 1.15 * smooth(t, edge - 0.30, edge - 0.035);
  const trail = 1 - smooth(age, -0.015, 0.15);
  if (length > 0 && trail > 0) {
    const end = muzzle.clone().add(new Vector3(dir * length, 0.05, 0));
    bar(end.clone().lerp(muzzle, trail), end, violet[0], 0.14 * trail);
    dot("shard", violet[1], end, 0.21 * trail);
  }
  if (age >= 0 && age < 0.29) {
    const f = 1 - smooth(age, 0.025, 0.29);
    for (let i = 0; i < 4; i++) {
      const ash = muzzle.clone().add(new Vector3(dir * (1.1 - i * 0.17), 0.13 - age * (0.6 + i), (i - 1.5) * age));
      dot("shard", violet[i % 3], ash, 0.11 * f, 0.18 * f, 0.11 * f, age * i, 0, i);
    }
  }
}
