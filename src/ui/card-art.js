// Restore the approved illustrated faces without changing live game values.
import {tributeCost} from "../game/cards.js";

function span(className, text) {
  const node=document.createElement("span");
  node.className=className;
  if(text!==undefined)node.textContent=text;
  return node;
}
export function describeCard(card) {
  if(card.kind==="spell")return card.name+", spell: "+(card.name==="Singularity"?"remove one enemy orb; optionally relocate the survivor.":"remove one enemy orb.");
  const cost=tributeCost(card.stars);
  return card.name+", "+card.stars+" stars, "+card.attack+" attack, "+card.health+" life orbs, "+(cost?cost+" tribute":"free summon");
}
export function createCardBody(card) {
  const body=span("card-body");
  body.setAttribute("aria-hidden","true");
  const face=span("card-face front-face");
  face.dataset.unit=card.name;
  if(card.name==="Billy"||card.name==="Wizard") {
    face.classList.add("illustrated");
    face.append(span("card-name sr-only",card.name));
  } else {
    face.classList.add("draft-face");
    face.dataset.kind=card.kind;
    const name=span("card-name",card.name);
    const stars=span("card-tier",card.kind==="spell"?"SPELL":"★".repeat(card.stars));
    const portrait=span("card-portrait");
    portrait.dataset.unit=card.name;
    if(!["Sheriff","Mounted Billy"].includes(card.name)) {
      const mark=span("card-mark",({Deadeye:"◎",Singularity:"◉",Skeleton:"†",Dragon:"♜"})[card.name]??"");
      portrait.append(mark);
    }
    const values=span("card-values");
    if(card.kind==="troop") {
      values.append(span("card-attack",String(card.attack)),span("stat-label","ATTACK"));
      const health=span("card-life");
      for(let i=0;i<card.health;i++)health.append(span("life-orb"));
      health.append(span("stat-label","LIFE"));
      values.append(health);
    } else {
      values.append(span("spell-copy",card.name==="Singularity"?"Remove 1 enemy orb.\nYou may move the survivor.":"Remove 1 enemy orb."));
    }
    const cost=tributeCost(card.stars);
    const footer=span("card-cost",card.kind==="spell"?"SPELL":cost?cost+" TRIBUTE":"FREE SUMMON");
    face.append(name,stars,portrait,values,footer);
  }
  const reverse=span("card-face card-reverse");
  body.append(face,reverse);
  for(let i=1;i<=7;i++) {
    const slice=span("card-slice");
    slice.style.setProperty("--z",i/8-.5);
    body.append(slice);
  }
  return body;
}
