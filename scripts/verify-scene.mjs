import assert from "node:assert/strict";
import {createDuel,timings,v} from "../src/render/scene.js";
import {grip,wizardStaffGrip} from "../src/render/rig.js";
import {localModels} from "./load-local.mjs";

const duel=await createDuel(await localModels());
assert.deepEqual(duel.stage.tiles.map(t=>t.faction),["cowboy","cowboy","cowboy","wizard","wizard","wizard"]);
for(const tile of duel.stage.tiles)assert(tile.top>0&&tile.top<.85);

const stand=duel.billy.root.position.clone(), wizard=duel.wizard;
const hand=wizard.rig.sides[1], staff=duel.staff.holder;
assert.equal(staff.parent,hand.hand);
const socket=wizardStaffGrip.clone().sub(hand.wrist);
const idleWandDirection=duel.staff.jewel.getWorldPosition(v()).sub(staff.getWorldPosition(v())).normalize();
function soleVertices(actor){
  const attr=actor.body.geometry.getAttribute("position");
  return Array.from({length:attr.count},(_,i)=>i).filter(i=>attr.getY(i)<.020);
}
const billySoles=soleVertices(duel.billy),wizardSoles=soleVertices(wizard);
const wizardFeet=wizardSoles.map(i=>wizard.body.getVertexPosition(i,v()).applyMatrix4(wizard.body.matrixWorld));
const world=v(),local=v(),wrist=v();
const geometry=wizard.body.geometry.getAttribute("position");
const fingers=[];
for(let i=0;i<geometry.count;i++)if(geometry.getX(i)>.234&&geometry.getY(i)<.41&&geometry.getZ(i)>.049)fingers.push(i);
let maxLift=0,aboveBoardBeforeRelease=0,wizardDrift=0,weaponDrift=0,staffSocketDrift=0,backwardTravel=0,orbitCount=0;
let shaftTilt=0,gripSamples=Infinity;
duel.reset("exchange");
for(let frame=0;frame<Math.ceil(timings.end*60);frame++){
  duel.step(1/60);
  const state=duel.state(),shot=state.elapsed-timings.drawStart,cast=state.elapsed-timings.castStart;
  const billy=duel.billy;
  maxLift=Math.max(maxLift,billy.root.position.y-stand.y);
  if(cast>1.83&&cast<timings.release){
    const boots=Math.min(...billySoles.map(i=>billy.body.getVertexPosition(i,world).applyMatrix4(billy.body.matrixWorld).y));
    aboveBoardBeforeRelease=Math.max(aboveBoardBeforeRelease,boots-stand.y);
    assert(billy.root.position.z<stand.z-.85);
  }
  if(state.landed)backwardTravel=Math.max(backwardTravel,billy.root.position.z-stand.z);
  for(let i=0;i<wizardSoles.length;i++){
    wizard.body.getVertexPosition(wizardSoles[i],world).applyMatrix4(wizard.body.matrixWorld);
    wizardDrift=Math.max(wizardDrift,world.distanceTo(wizardFeet[i]));
  }
  if(shot>=.34&&shot<=1.37)weaponDrift=Math.max(weaponDrift,duel.gun.holder.position.distanceTo(grip(billy,"right")));
  if(state.pulled&&!state.released)orbitCount=Math.max(orbitCount,duel.sim().hole.pulled.size);
  if(!state.hit)assert.equal(state.health.wizard,100);
  if(!state.repulse)assert.equal(state.health.billy,100);
  staff.getWorldPosition(world);
  wrist.copy(socket);
  hand.hand.localToWorld(wrist);
  staffSocketDrift=Math.max(staffSocketDrift,world.distanceTo(wrist));
  shaftTilt=Math.max(shaftTilt,duel.staff.jewel.getWorldPosition(v()).sub(world).normalize().angleTo(idleWandDirection));
  if(frame%12===0){
    const inverse=staff.matrixWorld.clone().invert();
    let nearShaft=0;
    for(const index of fingers){
      wizard.body.getVertexPosition(index,local).applyMatrix4(wizard.body.matrixWorld).applyMatrix4(inverse);
      if(Math.abs(local.y)<.059&&Math.hypot(local.x,local.z)<.027)nearShaft++;
    }
    gripSamples=Math.min(gripSamples,nearShaft);
  }
}
assert.deepEqual(duel.events,["shot","bullet-impact","charge","release","spell-impact","landing"]);
assert.deepEqual(duel.state().health,{billy:68,wizard:76});
assert(orbitCount>=20,orbitCount.toString());
assert(maxLift>1.32,maxLift.toString());
assert(aboveBoardBeforeRelease>.89,aboveBoardBeforeRelease.toString());
assert(backwardTravel>.55,backwardTravel.toString());
assert(wizardDrift<.0004,wizardDrift.toString());
assert(weaponDrift<.0004,weaponDrift.toString());
assert(staffSocketDrift<.00001,staffSocketDrift.toString());
assert(shaftTilt>.4,shaftTilt.toString());
assert(gripSamples>=10,gripSamples.toString());
duel.reset();
assert(duel.billy.root.position.distanceTo(stand)<.00001);
assert.equal(duel.state().affected,0);
assert.deepEqual(duel.state().health,{billy:100,wizard:100});
console.log(JSON.stringify({tiles:6,maxLift,aboveBoardBeforeRelease,backwardTravel,
  staffSocketDrift,minimumGripContactSamples:gripSamples,wizardDrift,orbitCount}));
